---
name: design-product-levels
description: Design and build the levels for a new product in Scale Architect (e.g. "make levels for chat app / news feed / cloud drive / video / ride hailing"). Researches the real system design discussions, turns each problem into a level (easy → hard), implements the product pack, balances it with the simulator and play-tests it. Use whenever the user names a system to add to the game.
---

# Design a product's levels

The user names a system (e.g. "chat app"). Turn it into 7–10 playable levels, each teaching one real system design problem. The URL shortener is the worked example to copy:
- Design doc: `docs/products/url-shortener.md`
- Code: `js/products/urlShortener/`

Work through the steps in order. Keep a task list. Don't stop at the design: the result is a playable product.

## 1. Research (web)

**Base source: Hello Interview.** Start from its problem breakdown (hellointerview.com/learn/system-design/problem-breakdowns/<problem>). If the page needs the user's login, ask them to open it in the browser pane and read it with `get_page_text`.
- Its requirements, its "bad → good → great" options and its deep dives decide the core levels and their order.
- Its linked pattern pages (e.g. Handling Large Blobs, Scaling Reads) feed the levels' deeper problems.

Then fill gaps with one or two more:
- ByteByteGo / Alex Xu "System Design Interview" chapter
- System Design Handbook, Educative
- The company's own engineering blog (Discord, Slack, WhatsApp, Uber, Dropbox, Netflix) for the real-world numbers

Extra levels from other sources go after the Hello Interview-based ones, and are marked as extras in the design doc.

Take the ideas, options and trade-offs, and write everything in our own words. Never copy their text into the repo.

Write down, with sources:
- Functional and non-functional requirements
- Back-of-envelope numbers: DAU, QPS (read and write), storage per item and in total, read:write ratio, latency targets
- API endpoints
- Each **deep dive**: the problem, the options, the trade-off, and what is usually chosen
- The components the final design uses, and in what order a real system would add them

## 2. Problems → levels

Write `docs/products/<product-id>.md` using the URL shortener doc's sections:
1. **Research table.** Topic, what sources say, real numbers.
2. **Problems → levels table.** For each level: the problem the player *feels*, the new machine, the new code fix or switch, and the key challenge.
   - Order levels from easy to hard. Level 1 is always "one server does everything".
   - Each level adds **one** new piece. Two pieces share a level only when they are one problem (e.g. sharding + global ID generator).
   - Unrelated problems get separate levels.
   - Aim for 7–10 levels; fewer is fine if the system is simple.
   - Every new piece must be *needed*: without it the level's goals can't be met.
3. **Game vs real numbers.** Keep ratios and orders of magnitude real; scale absolute numbers so things happen in minutes.

Map each problem to what the engine already models (see `reference/engine-capabilities.md`). Only add a mechanic when nothing existing teaches it, and add it **generically** (a level param or a new role), never `if (product === ...)`.

## 3. Build the product pack

Follow `reference/pack-template.md`:
- `js/products/<camelId>/levels.js`: levels with traffic params, `feature` (endpoints), `story`, `realWorld` notes, `completionMessage`, `audience`, `coinRate`
- `challenges.js`: goals per level, using helpers from `js/game/Challenges.js`
- `tutorial.js`: steps per level (`newMachineSteps` for most levels) plus `levelRole` and `suggestFix`
- `content.js`: vocab, incidents, explanation overrides, role/part/fix wording
- `index.js`: the pack (roles and unlock levels, scaleOut, fixes, xlLevel)
- Register it in `js/products/registry.js` (`PACKS`), and in `js/data/products.js` set `playable: true` with `levels: levelList(...)`

New mechanics checklist (only if needed):
- **Simulator** (`js/game/SystemSimulator.js`): add the param to `trafficParams` and the flow in `trafficFlow`, the load in `buildLoads`, and any status or `flows` fields. Guestbook numbers must not change when the param is absent.
- **Level params plumbing**: add the key to `GameState.trafficParams()` and to `PARAM_KEYS` in `tools/balance-levels.mjs`.
- **New machine role**: update all of these:
  - `js/data/roles.js`: ROLES, ROLE_ORDER, ROLE_TILES, CLOUD_EQUIVALENTS
  - a component id in `js/data/components.js`
  - `js/rendering/SystemDiagram.js`: `present()`, placement in `layout()`, tier box, edges, `edgeRate`, `pickKind`
  - an explanation key
- **New code fix**: add it to `js/data/codeFixes.js` with `unlockLevel: Infinity`, unlock it in the pack's `fixes`, and add an explanation. Use `toggle: true` for trade-off switches.
- **Live counters for goals**: `liveStats` in `GameState` (all three places) and `ResourceManager.tick`.

## 4. Balance

Run `node tools/balance-levels.mjs <product-id>` and iterate until:
- Every level's **with** row is `OK`
- Every level's **without <new machine>** row is `FAIL`, or shows a broken latency, disk, clash or accuracy flag that a goal checks
- **Money**: set each level's `coinRate` so revenue at the user target is ~2.5× the "with" row's running cost: `coinRate ≈ 2.5 × run / (0.3 × userTarget)`. Level 1 can stay generous (25) so the player can experiment.
- **Profit goals**: about 6 × that running cost per minute (roughly 6 minutes of a sensible margin).
- **Buy price**: affordable from the previous level's profit plus its funding round (`js/data/funding.js`: base 1.5k → 20k, scaled by users, margin and reliability). The playtest bot prints coins at each level's start: they should be about 1–3× what the level needs, not 10×.
- The level's `audience` is about 1.2–1.3× its user target, so latency and headroom goals are winnable

## 5. Play-test in the browser

Start the `game` preview server and pick the product. Then:
1. Play Level 1 by hand: the tutorial, building the server, placing it, opening to the public.
2. Use `reference/playtest-bot.js` to fast-forward every level. Each level should finish in roughly 4–12 simulated minutes.
3. Check there are no console errors.
4. Look at the diagram at desktop size and at about 560 px width.

Fix whatever blocks a level. Then re-run the Guestbook bot to make sure nothing regressed.

## 6. Wrap up

- Update `ROADMAP.md`: the product table, and a "Done" entry.
- Tell the user:
  - the level list (one line each)
  - the sources used
  - what you couldn't verify
  - anything that needs their call (e.g. money balance)
