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
| Left click (hold) / right click | mine — harder blocks dig slower / place |
| `1`–`0` or scroll wheel | pick block |
| `E` | inventory — all your items, with crafting |
| `H` | field guide — what every block looks like, does, and costs |
| `L` | launch a trade run to Aurelia (standing at the lander) |
| `C` | craft the selected block |
| `T` or `Enter` | chat (multiplayer) |
| `G` | creative mode (infinite blocks) |
| `F` | toggle flight |
| `Esc` | pause |

**Touch (tablets/phones):** controls appear automatically on touch devices and work alongside keyboard/mouse. Left joystick moves (analog), dragging the world looks around, and buttons handle jump ⤒ / descend ⤓ (flying), mine ⛏ (hold to keep digging), place ▣, craft C, flight ✈, pause, and ▤ inventory (beside the hotbar). Tap a hotbar slot to select it.

Crafting works two ways: press `C` to craft the selected hotbar slot, or open the **inventory** (`E` / ▤) to see everything you carry with craft buttons and recipes inline. The **hotbar is customizable**: select a slot (1–0), open the inventory, and hit `→ slot N` on any placeable item to bind it there — the layout persists in your save. The **field guide** (`H`, or the 📖 button on the menu, or `? guide` inside the inventory) pictures every block with its recipe and what it does.

Crafting works on the *selected hotbar slot*: select lichen (`7`), and the hint above the hotbar shows the recipe; press `C` to craft, then right-click to place. First goal: mine ice + regolith → craft lichen → plant it.

### Terraforming

The intended arc: **lichen first** (it tolerates any cold) → **heaters in a sealed, vented cave** to unlock real growth → a **glass-roofed greenhouse** full of trees becomes your breathable outpost → its oxygen and timber fund the **planet-scale forest** that finally turns the sky blue. Once the world is warm and breathable, culture **grazers** and let something live on it.

### Simulation rules

The planet's O₂/temperature are computed deterministically from the shared block-edit list, so every player derives identical stats from the same data — terraforming needs no extra netcode. Grazer positions are the one exception: the *nest block* is shared data, the animal wandering around it is local and cosmetic.

**Planet O₂** (HUD `O₂`, starts 0.2%, cap 21%)
- Each living block adds O₂: canopy 0.0045%, shrub 0.0035%, moss 0.002%, lichen 0.0008%. A grown tree carries ~22 canopy → ~0.1% per tree → **~100 trees for breathable (10%)**.

**Planet temperature** (HUD `temp`, starts −58°C, cap 28°C)
- `temp = −58 + 3°C per heater anywhere + 1.6°C per 1% O₂` (greenhouse effect). So heaters bootstrap warming, then forests take over.
- Heaters are **nuclear**: each one costs 2 rock + 1 **plutonium ore**, which only spawns deep underground (below y≈12 — the debug readout top-left shows your y). Warming the planet means real mining expeditions into the dark.

**Milestones**: >0°C frozen lakes melt and unmined surface ice sublimates · ≥10% O₂ the open air is breathable · ≥12% O₂ and ≥5°C the regolith turns green. The sky lerps from rust-dark to blue with O₂. **Buried ice veins never melt** — the deep cold keeps the lichen ingredient mineable on a warm world (Ceres-9 sells it too).

**Plant growth** — each planted block steps lichen → moss → shrub → tree at a base rate (~40s/60s/90s per step), scaled by:
- **Temperature**: below **−5°C** growth is ~×0.03 (dormant); above it, ×0.7 scaling up to ×2.2 at 28°C. **Lichen is exempt** — it keeps a ×0.3 floor in any cold, so the first step always works.
- **Enclosure ×3**: a sealed air pocket concentrates warmth and moisture.
- **Local warmth**: plants in a sealed pocket use the *pocket's* temperature: **+6°C per heater touching the pocket's air** (any face counts — a heater fully buried in a wall warms nothing; cap 35°C). Nine heaters lift a −58°C cave past the −5°C growth gate.
- **Sunlight ×1 / ×0.5**: a plant is sunlit if the column straight above it holds only air or **glass** — windows are real. Windowless caves grow at half speed; a glass roof fixes that.

**Air pockets** — a flood-fill from the air block above a plant (or from your head). Sealed = the flood neither reaches the sky nor exceeds **2000 air blocks**. One gap breaks the seal. The sealed-pocket badge shows the live size against the limit (e.g. `● sealed pocket · 640/2000 air`). Anything solid seals — including:
- **Air vents** (2 timber + 1 glass → 2): airtight but walk-through. A vented doorway keeps the pocket pressurized with no airlock dance.
- **Glass**: seals air *and* passes light — the greenhouse block.
- Standing in a sealed pocket the HUD shows a teal **● sealed pocket** badge plus its concentrated stats: pocket O₂ = planet O₂ + **0.1% per plant block with air above it** (cap 24%) → **~a dozen trees make a pocket breathable**; pocket temp = planet temp + 6°C per heater. Sealing or breaking a pocket announces itself with a toast and a chirp the moment it happens.
- If you're under a roof but *not* sealed, the HUD says why in amber: **◌ unsealed — air escapes somewhere** (hunt the hole) or **◌ cave too big to pressurize** (wall off a smaller chamber).

**Suit O₂** (gauge bottom-right; drains only when the local air is unbreathable)
- Drain: **~8 minutes per tank** in dead air; much faster underwater. Refill: **lander** (fast), sealed pocket at ≥10% O₂ (slow), breathable planet air (trickle).
- **<25%**: alarm pips + reddening screen edges. **<20%: exhausted** — you cannot mine or place blocks, walk at half speed, jump weakly. **<10%**: critical alarm. **0%**: blackout, revived at the lander.

**Mining** — hold left click (or the ⛏ button) with the crosshair on a block; a progress bar under the crosshair fills and the block pops when it completes. Hardness roughly tracks value: plants ~0.3s, regolith 0.45s, ice 0.6s, rock/cut rock/basalt 1s, beacons 1.1s, heaters 1.4s, **plutonium 2.6s**. Switching targets resets progress; keep holding to chew through a tunnel block by block. Creative mode still insta-mines.

**Grazers** — craftable life (2 lichen + 1 ice), **only when the planet is >0°C with ≥10% O₂**. Placing one sets its den; a fuzzy critter hops around within ~5 blocks of it, chirping when you're near. Mine the den to pick the grazer back up. One critter per den — place several for a herd.

**The starship & destinations** — the crashed lander doubles as the colony's starship. Stand on its pad and press `L` (or 🚀 in the inventory) to open the course picker. Three destinations, each with its own fuel cost, lane profile, and payoff:

- **Aurelia — Orbital Market** (2 plutonium, ~40s, balanced lane): sell colony goods and buy industrial stock for **credits (¢)**, which persist in your save. The station pays cheap and charges ~2×, so export what only your world makes: lichen 4¢, grazers 15¢; buying plutonium at 14¢ can beat mining once exports flow.
- **Ceres-9 — Ice Asteroid** (1 plutonium, ~25s, dense icy rocks, almost no pirates): land and fill the hold with **~10–14 ice + 1 plutonium**. The cheap grocery run for lichen farming.
- **The Meridian Wreck** (2 plutonium, ~35s, pirate-infested): pirate **bounties pay double (10¢)** in its hunting ground, and the hulk yields **40¢ + two crates of spare parts** (timber, glass, plutonium, or a heater). The skill run — a good pilot clears 100¢+ per trip.

**The flight is flown, not skipped**: an asteroid-and-pirate lane run. Steer with WASD/arrows (or drag on touch); your cannon fires automatically. Asteroids take hits by size, pirate daggers strafe and shoot aimed bolts, and the spawn rate climbs all the way. Kills pay **salvage on the spot** (+1¢ per rock, +5¢ per pirate). Your hull takes 3 hits — **lose it and the escape pod dumps you back at the colony, fuel gone**. `Esc` turns back early (fuel still spent).

**Jetpack** — you can't fly on the colony until you craft one (**4 timber + 2 glass + 2 plutonium**, via the inventory since it has no hotbar slot). `F` / ✈ toggles it. Each plutonium buys **12 seconds of burn, metered only while airborne** — land with fuel in the tank and it's still there next flight (it even survives saves; the readout top-left shows seconds left). The pack shuts off dry. Creative mode still flies free.

**Beacons** — craftable waymarkers (2 glass + 1 basalt): a lamp block that shines the same gold locator beam as the crashed lander's recharge station, visible across the terrain. Mark your greenhouse, your mine, your way home. (Basalt, ice and plutonium start off the hotbar as crafting ingredients — press `E` to see them, and assign them to a slot from there if you want to place them.)

## How it works

The client (`public/index.html`): raw WebGL 1 renderer (chunk meshing, translucent water pass, dynamic sky/fog), value-noise terrain with 3D-noise caves, procedural 23-tile texture atlas on a canvas, AABB physics, survival inventory + crafting, growth simulation with flood-fill enclosure and skylight detection, remote players as suited avatars with name tags, wandering grazer critters. A world is just `seed + edit list`: single-player saves to `localStorage`, multiplayer worlds live on the server, and milestone changes (ice→water, verdant ground) regenerate terrain losslessly from that same data.

The server (`src/server.js`): one Cloudflare Durable Object per colony stores the seed and edit history and relays edits/positions over WebSockets (hibernation API — idle worlds cost nothing). A singleton Lobby object tracks colonies for the `/worlds` menu list. Everything fits Cloudflare's free tier.

## Deploy (Cloudflare Workers)

```sh
npx wrangler login    # once
npx wrangler deploy
```

That serves the game and multiplayer at `https://planetcrafter.<your-subdomain>.workers.dev`. Or connect the repo in the Cloudflare dashboard (Workers Builds) with deploy command `npx wrangler deploy`. On a plain static host the game quietly falls back to single-player.

## Roadmap ideas

- Water/ice physics, weather as the atmosphere thickens
- More creatures (flyers once the air is thick, swimmers after the melt), synced herd movement
- Colony goals, per-biome plant species

## License

PlanetCrafter is free software, licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) — see [LICENSE](LICENSE). In short: you may use, study, modify and share it, but if you run a modified version as a network service (e.g. host your own colony server), you must offer its source to your users under the same license.
