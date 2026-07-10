# BlockCraft ⛏️

A Minecraft-style voxel sandbox that runs entirely in the browser — one HTML file, no dependencies, no build step.

Walk an endless procedurally generated world of hills, lakes, and forests. Dig, build, swim, or fly. Your world auto-saves in the browser and picks up where you left off.

## Play

Open [`public/index.html`](public/index.html) directly in a browser — that's it. No server needed for local play.

### Controls

| Input | Action |
|---|---|
| `W A S D` | move |
| Mouse | look around |
| `Space` | jump / swim up |
| Left click | break block |
| Right click | place block |
| `1`–`9` or scroll wheel | pick block |
| `F` | toggle flight |
| `Esc` | pause |

Needs a mouse and keyboard — touch isn't supported.

## How it works

Everything lives in `public/index.html` (~900 lines, ~30 KB):

- **Renderer** — raw WebGL 1, no libraries. The world is meshed in 16×16×64 chunks with hidden-face culling; water renders in a second translucent pass; distance fog hides chunk streaming.
- **Terrain** — layered value noise (seeded, deterministic) generates heights, beaches, lakes, and trees. Chunks stream in and out around the player.
- **Textures** — a 12-tile pixel-art atlas painted onto an offscreen canvas at startup. No image files.
- **Physics** — AABB collision resolved per axis, with gravity, jumping, swimming, and a flight mode.
- **Sound** — block break/place blips synthesized with the Web Audio API.
- **Persistence** — the world is stored as `seed + list of block edits` in `localStorage`, so saves are tiny and terrain regenerates deterministically.

## Deploy (Cloudflare Workers)

The repo is set up for [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/) — see [`wrangler.jsonc`](wrangler.jsonc).

```sh
npx wrangler login    # once
npx wrangler deploy
```

That serves the game at `https://blockcraft.<your-subdomain>.workers.dev`. Alternatively, connect the repo in the Cloudflare dashboard (Workers Builds) with deploy command `npx wrangler deploy`, and every push deploys.

Any static host works too (Vercel, GitHub Pages, …) — serve the `public/` folder.

## Roadmap ideas

- Multiplayer via a Cloudflare Durable Object relaying block edits and player positions (the seed+edits world model makes shared worlds cheap)
- Caves, day/night cycle, survival mode with block-breaking progress
