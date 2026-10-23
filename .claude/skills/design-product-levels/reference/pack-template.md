# Product pack template

Copy `js/products/urlShortener/` and rename. The files:

## levels.js
```js
export const <NAME>_LEVELS = [
  {
    level: 1,
    name: 'Short name',
    subtitle: 'What this level is about',   // shown in Goals and Levels
    mode: 'single-server',                   // 'app-db' from level 2
    serverMode: true,
    userTarget: 100,
    userGrowthRate: 2,                       // users per 2 s tick
    audience: 130,                           // growth stops here (~1.25× target)
    spikeRange: [1.2, 1.4],                  // level 1 only: small spikes
    startingCoins: 500,                      // level 1 only
    coinRate: 25,                            // revenue per 100 users per tick; lower it in later levels
    readKind: 'lookup', readsPerUser: 0.2, writesPerUser: 0.01,   // traffic: see engine-capabilities.md
    unlockedComponentIds: ['monolith'],
    unlockedFeatures: ['Feature A'],         // chips in the Levels tab
    feature: {                               // optional; later levels reuse the last one
      name: 'Feature name',
      summary: 'One or two sentences.',
      endpoints: [{ method: 'POST', path: '/api/x', does: 'What it does', rate: 'writesPerSec' }]
      // method: GET POST PAGE BOT EVT; rate: a field of serverStatus (readsPerSec, writesPerSec, botsPerSec, clicksPerSec, pagesPerSec)
    },
    realWorld: ['Real numbers and services, one point each.'],
    story: 'What the player is facing, in plain words.',
    completionMessage: 'What they learned.'
  }
];
```

## challenges.js
`export const <NAME>_CHALLENGES = { 1: [...], 2: [...] }`. Use the helpers. Every goal has an icon, an `info` key (explanation), a label, an obvious hint, and `progress(gs) → { value, target, unit, display? }`.

## tutorial.js
- Level 1 and level 2: copy the URL shortener's arrays (step ids `place`, `go_live`, `grow`, `place_db` are used to resume after a reload).
- Later levels: `newMachineSteps({ role, welcome, buy, extra, explain })`.
- Extra steps can set `builderTab` to open the right tab, and `advanceOn` with game events:
  - `serverBuilderOpened`
  - `serverBought`, `dbBought`, `machineBought`
  - `serverPlaced`, `dbPlaced`, `machinePlaced`
  - `appServerPlaced`, `dbShardPlaced`
  - `partWarning`, `serverUpgraded`, `codeFixBought`
- Export `<NAME>_STEPS`, `<NAME>_LEVEL_ROLE` (`{ level: role }`) and a `suggestFix(gs, role, partId)`.

## content.js
- `vocab`: record, records, writeFails, readName
- `incidents`: spike, bots, crash stories
- Text overrides:
  - `roleText` (job)
  - `partText` (whatItDoes)
  - `fixText` (name, short, effect)
  - `explanations` (keys from `js/data/explanations.js`, e.g. feature, storage, database, diskSpace, index, cache, cdn)

## index.js
```js
export default {
  id: '<product_id>',             // same id as in js/data/products.js
  levels, challenges, steps, levelRole, suggestFix,
  roles: { app: { unlockLevel: 1, maxCount: 6 }, db: { unlockLevel: 2, maxCount: 1 }, ... },  // unlisted roles are hidden
  scaleOut: { app: { level: 4, needs: 'lb', noun: 'app server' }, db: { level: 7, noun: 'shard' } },
  fixes: { index: 2, ... },       // fix id → unlock level; unlisted fixes are hidden
  xlLevel: { default: 4, storage: 3 },
  roleText, partText, fixText, explanations, incidents, vocab,
  tryIt: false                    // the hands-on panel exists only for the Guestbook
};
```

## Register
- `js/products/registry.js`: import the pack and add it to `PACKS`
- `js/data/products.js`: import the levels, set `playable: true`, `levels: levelList(<NAME>_LEVELS)`, and update tagline and concepts
