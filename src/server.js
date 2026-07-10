// PlanetCrafter — a voxel terraforming game.
// Copyright (C) 2026 Lars Kristian Roland
// Licensed under the GNU Affero General Public License v3.0 or later
// (AGPL-3.0-or-later). See the LICENSE file in the repository root.
//
// PlanetCrafter multiplayer relay — one Durable Object per named world.
// A world is fully described by (seed + block-edit history); the DO stores
// both and relays edits and player positions to everyone connected.
// A singleton Lobby DO tracks worlds so the menu can list joinable colonies.
// Uses the WebSocket hibernation API so idle worlds cost nothing.

const MAX_MSG = 512;
const REPORT_MS = 15000;

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class World {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.lastReport = 0;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });

    const url = new URL(req.url);
    const name = (url.searchParams.get('name') || 'colonist').slice(0, 20);
    const worldName = (url.searchParams.get('world') || 'outpost-1').slice(0, 32);
    const pass = (url.searchParams.get('pass') || '').slice(0, 64);
    await this.ctx.storage.put('worldName', worldName);

    let seed = await this.ctx.storage.get('seed');
    if (seed === undefined) {
      seed = crypto.getRandomValues(new Int32Array(1))[0];
      await this.ctx.storage.put('seed', seed);
      // a password supplied at creation locks the colony from then on
      if (pass) await this.ctx.storage.put('pass', await sha256(pass));
    } else {
      const lock = await this.ctx.storage.get('pass');
      if (lock && lock !== (pass ? await sha256(pass) : '')) {
        // wrong or missing password: tell the client why, then hang up
        const deny = new WebSocketPair();
        deny[1].accept();
        deny[1].send(JSON.stringify({ t: 'denied' }));
        deny[1].close(1008, 'password');
        return new Response(null, { status: 101, webSocket: deny[0] });
      }
    }

    const pair = new WebSocketPair();
    const id = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id, name });

    const edits = {};
    const stored = await this.ctx.storage.list({ prefix: 'e:' });
    for (const [k, v] of stored) edits[k.slice(2)] = v;
    this.editCount = stored.size;

    const players = this.ctx.getWebSockets()
      .filter(w => w !== pair[1])
      .map(w => { const a = w.deserializeAttachment(); return { id: a.id, name: a.name }; });

    pair[1].send(JSON.stringify({ t: 'join', you: id, seed, edits, players }));
    this.broadcast(pair[1], { t: 'joined', id, name });
    this.report(true);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const a = ws.deserializeAttachment();
    if (!a) return;

    if (m.t === 'pos' && [m.x, m.y, m.z, m.yaw].every(Number.isFinite)) {
      this.broadcast(ws, { t: 'pos', id: a.id, x: m.x, y: m.y, z: m.z, yaw: m.yaw });
    } else if (m.t === 'chat' && typeof m.msg === 'string') {
      const msg = m.msg.slice(0, 160).trim();
      if (!msg) return;
      const now = Date.now();
      if (!this.chatAt) this.chatAt = new Map();
      if (now - (this.chatAt.get(a.id) || 0) < 400) return; // rate limit
      this.chatAt.set(a.id, now);
      this.broadcast(ws, { t: 'chat', id: a.id, name: a.name, msg });
    } else if (m.t === 'set'
        && [m.x, m.y, m.z, m.id].every(Number.isInteger)
        // max id must track the block table (INFO) in public/index.html
        && m.y >= 0 && m.y < 64 && m.id >= 0 && m.id <= 19
        && Math.abs(m.x) < 1e7 && Math.abs(m.z) < 1e7) {
      await this.ctx.storage.put('e:' + m.x + ',' + m.y + ',' + m.z, m.id);
      this.editCount = (this.editCount || 0) + 1;
      this.broadcast(ws, { t: 'set', x: m.x, y: m.y, z: m.z, id: m.id });
      this.report(false);
    }
  }

  webSocketClose(ws) { this.dropped(ws); }
  webSocketError(ws) { this.dropped(ws); }
  dropped(ws) {
    const a = ws.deserializeAttachment();
    if (a) this.broadcast(ws, { t: 'leave', id: a.id });
    this.report(true);
  }

  broadcast(except, obj) {
    const s = JSON.stringify(obj);
    for (const w of this.ctx.getWebSockets())
      if (w !== except) try { w.send(s); } catch (e) {}
  }

  report(force) {
    const now = Date.now();
    if (!force && now - this.lastReport < REPORT_MS) return;
    this.lastReport = now;
    this.ctx.waitUntil((async () => {
      try {
        const worldName = await this.ctx.storage.get('worldName');
        if (!worldName) return;
        await this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby')).fetch('https://lobby/report', {
          method: 'POST',
          body: JSON.stringify({
            world: worldName,
            players: this.ctx.getWebSockets().length,
            edits: this.editCount || 0,
            locked: !!(await this.ctx.storage.get('pass')),
          }),
        });
      } catch (e) {}
    })());
  }
}

export class Lobby {
  constructor(ctx) {
    this.ctx = ctx;
  }
  async fetch(req) {
    if (req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch { return new Response('bad', { status: 400 }); }
      if (typeof b.world !== 'string' || !b.world) return new Response('bad', { status: 400 });
      await this.ctx.storage.put('w:' + b.world.slice(0, 32),
        { players: b.players | 0, edits: b.edits | 0, locked: !!b.locked, ts: Date.now() });
      return new Response('ok');
    }
    const out = [];
    for (const [k, v] of await this.ctx.storage.list({ prefix: 'w:' }))
      out.push({ name: k.slice(2), players: v.players, edits: v.edits, locked: !!v.locked, ts: v.ts });
    out.sort((a, b) => b.players - a.players || b.ts - a.ts);
    return Response.json(out.slice(0, 50));
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const world = (url.searchParams.get('world') || 'outpost-1').slice(0, 32) || 'outpost-1';
      return env.WORLD.get(env.WORLD.idFromName(world)).fetch(req);
    }
    if (url.pathname === '/worlds')
      return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(req);
    // static assets are served before the worker; anything else is unknown
    return new Response('not found', { status: 404 });
  }
};
