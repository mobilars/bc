// BlockCraft multiplayer relay — one Durable Object per named world.
// The world is fully described by (seed + block-edit history); the DO stores
// both and relays edits and player positions to everyone connected.
// Uses the WebSocket hibernation API so idle worlds cost nothing.

const MAX_MSG = 512;

export class World {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });

    const url = new URL(req.url);
    const name = (url.searchParams.get('name') || 'player').slice(0, 20);

    let seed = await this.ctx.storage.get('seed');
    if (seed === undefined) {
      seed = crypto.getRandomValues(new Int32Array(1))[0];
      await this.ctx.storage.put('seed', seed);
    }

    const pair = new WebSocketPair();
    const id = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id, name });

    const edits = {};
    for (const [k, v] of await this.ctx.storage.list({ prefix: 'e:' }))
      edits[k.slice(2)] = v;
    const players = this.ctx.getWebSockets()
      .filter(w => w !== pair[1])
      .map(w => { const a = w.deserializeAttachment(); return { id: a.id, name: a.name }; });

    pair[1].send(JSON.stringify({ t: 'join', you: id, seed, edits, players }));
    this.broadcast(pair[1], { t: 'joined', id, name });
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
    } else if (m.t === 'set'
        && [m.x, m.y, m.z, m.id].every(Number.isInteger)
        && m.y >= 0 && m.y < 64 && m.id >= 0 && m.id <= 10
        && Math.abs(m.x) < 1e7 && Math.abs(m.z) < 1e7) {
      await this.ctx.storage.put('e:' + m.x + ',' + m.y + ',' + m.z, m.id);
      this.broadcast(ws, { t: 'set', x: m.x, y: m.y, z: m.z, id: m.id });
    }
  }

  webSocketClose(ws) { this.dropped(ws); }
  webSocketError(ws) { this.dropped(ws); }
  dropped(ws) {
    const a = ws.deserializeAttachment();
    if (a) this.broadcast(ws, { t: 'leave', id: a.id });
  }

  broadcast(except, obj) {
    const s = JSON.stringify(obj);
    for (const w of this.ctx.getWebSockets())
      if (w !== except) try { w.send(s); } catch (e) {}
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const world = (url.searchParams.get('world') || 'overworld').slice(0, 32) || 'overworld';
      return env.WORLD.get(env.WORLD.idFromName(world)).fetch(req);
    }
    // static assets are served before the worker; anything else is unknown
    return new Response('not found', { status: 404 });
  }
};
