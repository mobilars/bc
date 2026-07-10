# BlockCraft ⛏️

A Minecraft-style voxel sandbox that runs in the browser — one HTML file for the game, one small Cloudflare Worker for multiplayer, no build step.

Walk an endless procedurally generated world of hills, lakes, and forests. Mine blocks to collect them, craft, build, swim, or fly — alone or in a shared world with friends.

## Play

**Single player:** open [`public/index.html`](public/index.html) directly in a browser — no server needed.

**Multiplayer:** deploy (see below) and share the URL. Everyone on the same URL shares a persistent world; pick a different world with `?world=yourname` or the World field on the menu. Player name is set on the menu too.

### Controls

| Input | Action |
|---|---|
| `W A S D` | move |
| Mouse | look around |
| `Space` | jump / swim up |
| Left click | break block (adds it to your inventory) |
| Right click | place block (consumes inventory) |
| `1`–`9` or scroll wheel | pick block |
| `C` | craft the selected block (planks ← log, glass ← sand, cobblestone ← stone) |
| `G` | toggle creative mode (infinite blocks) |
| `F` | toggle flight |
| `Esc` | pause |

Needs a mouse and keyboard — touch isn't supported.

## How it works

The client (`public/index.html`, ~1100 lines):

- **Renderer** — raw WebGL 1, no libraries. The world is meshed in 16×16×64 chunks with hidden-face culling; water renders in a second translucent pass; distance fog hides chunk streaming. Remote players are drawn as blocky avatars with projected HTML name tags.
- **Terrain** — layered value noise (seeded, deterministic) generates heights, beaches, lakes, and trees. Chunks stream in and out around the player.
- **Textures** — a 16-tile pixel-art atlas painted onto an offscreen canvas at startup. No image files.
- **Physics** — AABB collision resolved per axis, with gravity, jumping, swimming, and flight.
- **Survival inventory** — broken blocks go to your inventory and placing spends it; three craft rules cover the blocks that don't occur naturally. `G` switches to creative.
- **Persistence** — a world is just `seed + list of block edits`, so saves are tiny and terrain regenerates deterministically. Single-player worlds save to `localStorage`; multiplayer worlds live on the server.

The server (`src/server.js`, ~100 lines): one Cloudflare Durable Object per named world. It stores the seed and edit history in Durable Object storage, and relays block edits and player positions to everyone connected over WebSockets (hibernation API, so idle worlds cost nothing). Everything fits in Cloudflare's free tier.

## Deploy (Cloudflare Workers)

```sh
npx wrangler login    # once
npx wrangler deploy
```

That serves the game and the multiplayer server at `https://blockcraft.<your-subdomain>.workers.dev`. Alternatively, connect the repo in the Cloudflare dashboard (Workers Builds) with deploy command `npx wrangler deploy`, and every push deploys.

If the page is hosted somewhere without the Worker (a plain static host), the game quietly falls back to single-player.

## Roadmap ideas

- Caves and ore, day/night cycle
- Block-breaking progress (mining time by material)
- Chat, player skins
