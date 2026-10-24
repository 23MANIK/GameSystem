# Data pack format (generated games)

A data pack is a whole product as one JSON file, with no code. `js/products/dataPack.js` checks it (`validateDataPack`) and turns it into a normal product pack (`compileDataPack`). Create DesignGame writes these; the URL Shortener in this format is `tools/designgame/url-shortener.pack.json`, and a test checks it plays exactly like the hand-made one.

Run the usual tools on a data pack with `--pack`:

```bash
node tools/check-pack.mjs --pack game.json
node tools/balance-levels.mjs --pack game.json
node tools/playtest-headless.mjs --pack game.json
```

## Top level

| Field | What it is |
|---|---|
| `format` | Always `1` |
| `id` | `dg_` + lowercase name, e.g. `dg_ride_hailing` |
| `meta` | `name`, `icon` (one emoji), `likeWhat`, `tagline`, `concepts` (list), `sources` (list of `{ title, url }`) |
| `levels` | 2–12 level objects, `level` numbered 1, 2, 3… (fields below) |
| `roles` | `{ role: { unlockLevel, maxCount? } }`. Roles: app, db, web, gateway, lb, cache, cdn, idgen, blob, sync, queue. `app` is required |
| `scaleOut` | `{ app: { level, needs: 'lb', noun }, db: { level, noun } }` |
| `fixes` | `{ fixId: unlockLevel }`, ids from `js/data/codeFixes.js` |
| `xlLevel` | A level number, or `{ default, cpu, ram, storage, network }` |
| `goals` | `{ "1": [goal, …], … }`, at least one per level (types below) |
| `tutorial` | `{ "1": steps, … }`, one per level (format below) |
| `levelRole` | `{ "3": "gateway", … }`, the machine each level is about (filled in from the tutorial if missing) |
| `suggestFix` | `[{ fix, roles?, parts?, minLevel? }]`: the first unbought match is offered when a part is busy |
| `vocab` | `record`, `records`, `writeFails`, `readName` |
| `incidents` | `{ spike: [...], bots: [...], crash: [...] }`, each `{ name, story, mult? }` (crash: `crashed: 1`) |
| `roleText`, `partText`, `fixText`, `explanations` | Wording overrides, same as a hand-made pack |
| `playtest` | Optional hints for the play-test bot: `{ fixes, apps, shards }` |

## Levels

The same fields as `js/products/<product>/levels.js`. Only known fields are accepted:

- Numbers: `userTarget`, `userGrowthRate`, `audience`, `startingCoins`, `coinRate`, and every traffic param in `.claude/skills/design-product-levels/reference/engine-capabilities.md` (`readsPerUser`, `writesPerUser`, `botShare`, `cacheHitRate`, `fanoutPerWrite`, …)
- Text: `name`, `subtitle`, `intro`, `story`, `completionMessage`
- Lists of text: `unlockedComponentIds`, `unlockedFeatures`, `realWorld`
- Choices: `mode` (`single-server` | `app-db`), `readKind` (`all` | `lookup`), `botKind` (`read` | `write`)
- True/false: `serverMode`, `crashes`, `clickTracking`, `shardIdClash`
- `spikeRange: [low, high]`
- `feature: { name, summary, endpoints: [{ method, path, does, rate }] }`

## Goals

Every goal has `type` and `hint`; `label`, `icon`, `info` (explanation key) and `id` are optional overrides.

| type | Fields | Done when |
|---|---|---|
| `users` | `target` | that many users online |
| `latency` | `ms`, `users` | latency under `ms` with `users`+ online |
| `placed` | `role` | that machine is placed |
| `incident` | `kind` (spike, bots, crash) | the incident is survived |
| `profit` | `target` | that much profit this level |
| `records` | `target` | that many records stored |
| `fixOwned` | `fix` | the code fix is bought |
| `counter` | `stat`, `target`, `label`, `unit?` | `gs.liveStats[stat]` reaches `target` (botsBlocked, clicksCounted, cleanLinks, feedWrites…) |
| `machines` | `role` (app, db), `target` | that many app servers / shards |
| `errorRate` | `max` (0.01 = 1%), `users` | failures under `max` with `users`+ online |
| `statAtLeast` | `stat`, `min` (0–1), `label`, `users?`, `displayLabel?` | `gs.serverStatus[stat]` ≥ `min` (cacheHit, clickAccuracy…) |
| `cpuUnder` | `role`, `max` (0–1), `users` | that machine's CPU under `max` at `users` |

Two goals in one level can't be the same type and target thing unless one has its own `id`.

## Tutorial

Either a list of steps, or the usual new-machine walkthrough:

```json
{ "newMachine": { "role": "cache", "welcome": "…", "buy": "…", "explain": "…", "extra": [step, …] } }
```

A step is `{ id, text, button?, advanceOn?, highlight?, builderTab?, role?, showInBuilder?, minimizeAfterButton?, finishAfterButton? }`. It needs a `button` or an `advanceOn` event (serverBuilderOpened, serverBought, dbBought, machineBought, serverPlaced, dbPlaced, machinePlaced, appServerPlaced, dbShardPlaced, partWarning, serverUpgraded, codeFixBought). `highlight` is one of `#nav-server`, `#nav-goals`, `#hud-resources`.

Built-in steps whose text depends on the live game: `{ "kind": "bottleneckSingle" }` (level 1), `{ "kind": "bottleneckMulti" }` (names the busy machine, suggests a fix), `{ "kind": "goLive", "text": "…" }` (the "Open to the public" step).

Levels 1 and 2 keep the step ids `place`, `go_live`, `grow`, `place_db`: the game uses them to resume after a reload.

## Text

All text is shown as HTML, so it is cleaned: only `<strong>`, `<em>`, `<code>`, `<b>`, `<i>` and `<br>` are kept, everything else is shown as plain text. Text fields are capped (1,200 characters; shorter for names and labels).

## What a data pack can't do

It only reuses the machines, code fixes and traffic params the engine already has. A new mechanic still needs code (see the `design-product-levels` skill).
