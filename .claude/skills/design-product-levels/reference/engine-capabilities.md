# What the engine already models

Use these before inventing anything new. "Param" means a field on a level in the pack's `levels.js`.

## Traffic (per online user per second)
| Param | Meaning |
|---|---|
| `readsPerUser`, `writesPerUser` | Real user reads / writes |
| `readKind: 'all' \| 'lookup'` | 'all' = response grows with data (feeds, lists); 'lookup' = one row by key |
| `pageViewsPerUser`, `pageKB` | Heavy UI pages (makes a web server worthwhile) |
| `botShare` + `botKind: 'read'` | Scrapers: extra reads per real read |
| `botKind: 'write'` + `spamPerUser` | Spam writes (stored too: fills disks) |
| `crashes: true` | App servers crash now and then (needs LB + several app servers) |
| `cacheHitRate`, `edgeHitRate` | Product-specific cache / CDN hit rates (default rules depend on pagination) |
| `clickTracking: true` | Every read also records an event: inline DB write, or queue + batch of 50 |
| `globalShare`, `distanceMs` | Share of far-away users and their extra latency (CDN fixes it) |
| `dbReadCost`, `appCallCost` | CPU per DB read / per API call |
| `keepRecords` | Rows kept once `archive` / `expiry` is on |
| `fanoutPerWrite` | Feed writes per real post (fan-out on write). No queue: app CPU + post latency (0.5 ms per feed write, capped 150). Queue placed: workers on the queue do it; if queue CPU > 100% a backlog grows (`liveStats.fanoutBacklog`). Writes land in the cache (or DB without one) |
| `celebrityShare`, `celebrityMult` | Share of posts from huge accounts (default 0) and how many times bigger their fan-out is (default 1000) |
| `audience`, `spikeRange` | Growth cap; spike size override |

## Machines (roles)
app (several behind lb), db (shards with `scaleOut.db`), web, gateway (rate limiting), lb, cache, cdn, idgen (unique IDs), queue (async events).

Each machine has CPU / RAM / Storage / Network parts. Loads are `base + perUser × users`, so every part has a user limit and the game names the bottleneck.

## Code fixes
- Guestbook: pagination, index, archive
- URL shortener: index, base62, idRanges, expiry, redirect301 (toggle)
- News feed: hybridFanout (celebrity posts skip fan-out; each feed read pulls `celebrityShare × 10` extra reads from the cache, +3 ms)

Each fix is shared and can be reused by any product. Change its wording with the pack's `fixText`.

## Incidents
spike (more traffic), bots (bot traffic ×3–4; spam when `botKind: 'write'`), crash (one app server down). Change their stories with the pack's `incidents`.

## Goal helpers (`js/game/Challenges.js`)
- `placedChallenge(role, icon, label, hint)`
- `usersChallenge(target, hint)`
- `latencyChallenge(ms, users, hint)`
- `incidentChallenge(kind, { label, hint })`
- `profitChallenge(target, hint)`
- `cpuAtUsers(gs, role, users)`

Custom goals read `gs` directly, for example:
- `gs.guestbook.count` (records stored)
- `gs.liveStats.*` (botsBlocked, clicksCounted, cleanLinks, feedWrites, fanoutBacklog, fanoutClearSec (s in a row with no backlog), …)
- `gs.serverStatus.*` (cacheHit, clickAccuracy, …)
- `gs.codeFixes`
- `gs.appCount()`, `gs.dbCount()`

## Ideas for mechanics other products will need
Add each one generically, as a param or a role:
- **Chat**: long-lived connections (RAM per connected user on a "websocket" role), fan-out to group members, offline message queue, presence heartbeats
- **Cloud drive / video**: object storage role (cheap space, slow), large uploads (network), chunking and dedup (a fix cutting storage), transcoding workers via queue
- **Ride hailing**: frequent location writes (write-heavy), geo index (a fix), sharding by region
