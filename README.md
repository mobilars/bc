# PlanetCrafter 🪐

A voxel terraforming game that runs in the browser — one HTML file for the game, one small Cloudflare Worker for multiplayer, no build step.

You crash-land on a dead red rock: thin dark sky, −58°C, frozen lakes, buried ice, caves. Plant lichen, build heaters, grow alien forests — and watch the sky turn blue, the ice melt, and the regolith go green.

## Play

**Single player:** open [`public/index.html`](public/index.html) directly in a browser.

**Multiplayer:** deploy (below) and share the URL. Everyone in the same *colony* (world) terraforms the same planet. The menu lists active colonies to join — or type a new name to found one (`?world=name` in the URL works too). Other colonists appear as suited avatars with name tags and a colored **locator beam** visible across the terrain; the top-left readout lists everyone's distance and bearing, and `T` opens chat.

### Controls

| Input | Action |
|---|---|
| `W A S D` / Mouse / `Space` | move, look, jump/swim |
| Left / right click | mine (collects the block) / place |
| `1`–`9` or scroll wheel | pick block |
| `C` | craft the selected block |
| `T` or `Enter` | chat (multiplayer) |
| `G` | creative mode (infinite blocks) |
| `F` | toggle flight |
| `Esc` | pause |

Crafting works on the *selected hotbar slot*: select lichen (`7`), and the hint above the hotbar shows the recipe; press `C` to craft, then right-click to place. First goal: mine ice + regolith → craft lichen → plant it.

### Terraforming

- **Lichen** is crafted from ice + regolith. Plant it and it grows: lichen → moss → shrub → alien tree. Every living block adds **O₂**.
- **Heaters** (rock + basalt) raise **temperature**; O₂ adds greenhouse warming on top.
- Plants in a **sealed air pocket** (caves, glass domes) grow 3× faster, and the HUD shows the concentrated pocket O₂ when you stand inside one. The seal is literal — one open doorway leaks. There are no doors, so use a block as an airlock: seal the entrance behind you (glass makes a nice window) and mine it open to leave. Pockets over ~350 air blocks are too big to pressurize.
- Milestones reshape the planet: above **0°C** the frozen lakes melt into open water; at **10% O₂** the air is breathable; at **12% O₂ + 5°C** the regolith itself turns green. The sky shifts from rust-dark to blue as the atmosphere thickens.
- **Suit O₂**: until the planet is breathable, your suit tank drains slowly (~12 minutes per fill; faster underwater). Refill fast at the **crashed lander** at spawn — the glowing beacon on the cut-rock pad — or slowly inside a sealed pocket holding ≥10% O₂, which makes caves and greenhouses real outposts. Run dry and you black out, waking at the lander. The gauge sits bottom-right; once the atmosphere reaches 10% O₂ it reads AIR OK.

The planet's O₂/temperature are computed deterministically from the shared block-edit list, so every player derives identical stats from the same data — terraforming needs no extra netcode.

## How it works

The client (`public/index.html`): raw WebGL 1 renderer (chunk meshing, translucent water pass, dynamic sky/fog), value-noise terrain with 3D-noise caves, procedural 20-tile texture atlas on a canvas, AABB physics, survival inventory + crafting, growth simulation with flood-fill enclosure detection, remote players as suited avatars with name tags. A world is just `seed + edit list`: single-player saves to `localStorage`, multiplayer worlds live on the server, and milestone changes (ice→water, verdant ground) regenerate terrain losslessly from that same data.

The server (`src/server.js`): one Cloudflare Durable Object per colony stores the seed and edit history and relays edits/positions over WebSockets (hibernation API — idle worlds cost nothing). A singleton Lobby object tracks colonies for the `/worlds` menu list. Everything fits Cloudflare's free tier.

## Deploy (Cloudflare Workers)

```sh
npx wrangler login    # once
npx wrangler deploy
```

That serves the game and multiplayer at `https://planetcrafter.<your-subdomain>.workers.dev`. Or connect the repo in the Cloudflare dashboard (Workers Builds) with deploy command `npx wrangler deploy`. On a plain static host the game quietly falls back to single-player.

## Roadmap ideas

- O₂ as a survival constraint (suit tank outside breathable zones)
- Water/ice physics, weather as the atmosphere thickens
- Chat, colony goals, per-biome plant species
