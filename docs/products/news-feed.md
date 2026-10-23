# News Feed (like Twitter / Instagram): level design

## 1. What the real design discussions cover

Sources:
- Hello Interview, *Design Facebook's News Feed*: https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-news-feed
- High Scalability, *The Architecture Twitter Uses to Deal with 150M Active Users* (Raffi Krikorian talk, 2012–13): https://highscalability.com/the-architecture-twitter-uses-to-deal-with-150m-active-users/
- ByteByteGo / Alex Xu, *Design a News Feed System* (System Design Interview Vol. 1, ch. 11), from memory, not re-fetched (paywalled): numbers marked (unverified)

| Topic | What they say | Real numbers |
|---|---|---|
| Requirements | Post, follow (one-way), see a feed of followed users' posts newest-first, page through it. Likes, comments, privacy left out | Feed and post under 500 ms; availability over consistency, posts may show up to 1 min late; 2B users; no cap on follows/followers |
| Traffic | Extremely read-heavy: people scroll far more than they post | Twitter (2012): ~300K timeline reads/s vs ~5–6K tweets/s (12K peak) → ~50:1. ByteByteGo: 10M DAU, up to 5,000 friends (unverified) |
| Storage | Post row (id, author, text, time, media link); follow edge; precomputed feed = list of post IDs | Hello Interview: 200 IDs × 10 B ≈ 2 KB per user ≈ 4 TB for 2B users. Twitter kept up to 800 IDs per home timeline in Redis |
| API | `POST /posts {content}` → postId; `PUT /users/{id}/follow` (idempotent); `GET /feed?pageSize&cursor` → items + nextCursor | Cursor = timestamp of the oldest post already shown |
| Data model | Follow table keyed (follower, followee) plus reversed index for "who follows me"; posts indexed by (author, createdAt) | DynamoDB in Hello Interview; graph DB in ByteByteGo (unverified) |
| Naive feed (fan-out on read) | On every feed load, get followees, query each one's recent posts, merge-sort | One query per followee: fine at tens, painful at thousands |
| Pagination | Offset paging breaks when new posts arrive; use a cursor (time or post ID) | — |
| Precomputed feeds (fan-out on write) | When someone posts, push the post ID into every follower's feed list; reads become one lookup | Trade storage + write work for fast reads; fall back to on-read query past the stored window |
| Fan-out work | Doing it inline in the post request hits timeouts; put a job on a queue (SQS/Kafka), workers update feeds, at-least-once | Twitter aimed to finish fan-out within ~5 s; one post can be 1K or 90M+ inserts, so split big jobs |
| Celebrity problem | Fan-out for huge accounts is too slow/expensive | Hybrid: flag big accounts, skip their fan-out, merge their recent posts at read time. Threshold is tunable |
| Feed/post caching | Feed cache (Redis lists) plus post cache keyed by post ID, long TTL, LRU, invalidate on edit | Twitter served home timelines from Redis memory only |
| Hot posts | A viral post overloads one cache shard | Replicate the post cache: N copies → ~N× hot-key throughput, at the cost of N misses and less unique data |
| Scale out | Stateless Post and Feed services behind a load balancer / API gateway; shard posts and feeds by ID | — |
| Media | Images/video go to object storage, served via CDN; post holds only the link | (from ByteByteGo, unverified) |
| Abuse / limits | Rate-limit posting; cap follows (Facebook caps friends at 5,000) | — |

### Order a real system adds components
1. One server + one database: post, follow, build the feed by querying followees on every load.
2. Index posts by (author, time) and follows by both directions; cursor pagination.
3. Stateless app servers behind a load balancer as reads climb.
4. Post cache (Redis) in front of the DB; CDN/object storage for media.
5. Precomputed feeds (fan-out on write) stored in a feed cache.
6. Message queue + fan-out workers so posting stays fast.
7. Hybrid fan-out: celebrity posts merged at read time.
8. Replicated cache for hot/viral posts; sharded DB and feed store.
9. Rate limiting on posting and follow caps.

## 2. Problems → levels (easy to hard)

Role order copies the URL shortener (app → db → gateway → lb → cache → queue → shards + idgen → cdn), one new piece per level. Fan-out uses the new `fanoutPerWrite` / `celebrityShare` params and `hybridFanout` fix (section 5); the precomputed feed with `cache` + `cacheHitRate` + a switch to `readKind: 'lookup'`.

| # | Level | Problem the player feels | New machine | New code fix / switch | Key challenge |
|---|---|---|---|---|---|
| 1 | Hello, Posts | One box stores posts and builds every feed by reading everything | One server (app) | — | 100 users, 300 posts, < 60 ms, survive spike |
| 2 | The Feed Gets Slow | Each feed load scans every followee's posts and returns all of them; the server's disk fills | Database | Cursor pagination (`pagination`), index on (author, time) (`index`) | 3,000 posts, < 80 ms at 400 users |
| 3 | Spam Accounts | Bot accounts post 20× more than people: DB writes and disk explode | API gateway (rate-limit posting) | — | Block 20k spam posts, < 1% errors, survive spam attack |
| 4 | Everyone Scrolls | 1,500 users scroll 50× more than they post; one server crashes and the feed is gone | Load balancer (+ app servers) | Keep only the newest window in the hot DB (`archive`) | 3 app servers, survive crash |
| 5 | Precomputed Feeds | Merging followees' posts on every scroll swamps the DB; a viral post spikes reads | Cache (feed cache: list of post IDs per user) | — (the level switches reads to one list lookup; fan-out on write raises write cost) | Hit rate ≥ 90%, DB CPU < 50%, < 45 ms, survive spike |
| 6 | Background Fan-out | Each post writes into every follower's feed inside the request: posting takes seconds, app and cache CPU spike | Message queue (+ fan-out workers) | — | Post latency < 60 ms, 20k feed writes done |
| 7 | Celebrity Problem | A few huge accounts' posts each need ~1,000× the fan-out; the queue backs up and feeds go stale | — | **Hybrid fan-out** (`hybridFanout`, new toggle) | Fan-out backlog cleared, < 50 ms reads, survive spike |
| 8 | Billions of Posts | One DB's disk and writes run out; per-shard post IDs clash and break time ordering | DB shards + ID generator (Snowflake-style) | `idRanges` | 3 shards, 10k posts with no clashes |
| 9 | Photos Worldwide | Photo-heavy pages and far-away users pay 100+ ms | CDN | — | < 80 ms at 5,000 users |

Dropped: the "seen / like events" (`clickTracking`) idea; the queue now teaches real background fan-out. A replicated hot-post cache is told only in L5/L7 realWorld notes (the spike stands in for a viral post).

## 3. Engine mapping

All levels: `readKind: 'all'` until the feed cache (L5+ `'lookup'`), `audience ≈ 1.25 × userTarget`. Read:write climbs toward the real ~50:1.

| # | Traffic params | New role | Fixes unlocked | Goals (helpers) | Users / audience |
|---|---|---|---|---|---|
| 1 | `readsPerUser 0.4, writesPerUser 0.05, readKind 'all'`, `coinRate 25` | app | — | `placedChallenge('app')`, `usersChallenge(100)`, custom `gs.guestbook.count ≥ 300`, `latencyChallenge(60,100)`, `incidentChallenge('spike')` | 100 / 125 |
| 2 | `readsPerUser 0.6, writesPerUser 0.05, readKind 'all', dbReadCost` high (followee merge) | db | `pagination`, `index` (fixText: "cursor pagination", "index on author+time") | `placedChallenge('db')`, posts ≥ 3,000, `latencyChallenge(80,400)`, `profitChallenge` | 400 / 500 |
| 3 | + `botKind 'write', spamPerUser 1.0` (~20× real writes), `botShare` n/a | gateway | — | `placedChallenge('gateway')`, `liveStats.botsBlocked ≥ 20k`, error < 1%, `incidentChallenge('bots')` | 600 / 750 |
| 4 | `readsPerUser 1.0, writesPerUser 0.02` (50:1), `crashes: true`, `keepRecords ~2000` | lb | `archive` (fixText: "keep the newest feed window") | `placedChallenge('lb')`, `gs.appCount() ≥ 3`, `incidentChallenge('crash')`, `usersChallenge(1500)` | 1,500 / 1,900 |
| 5 | `readsPerUser 1.2, writesPerUser 0.03, readKind 'lookup', cacheHitRate 0.92, appCallCost` up (fan-out on write) | cache | — | `placedChallenge('cache')`, `serverStatus.cacheHit ≥ 0.9`, `cpuAtUsers(gs,'db',…) < 50%`, `latencyChallenge(45,…)`, `incidentChallenge('spike')` | 2,000 / 2,500 |
| 6 | + `fanoutPerWrite 30` | queue | — | `placedChallenge('queue')`, custom `liveStats.feedWrites ≥ 20k`, `latencyChallenge(60,…)` | 2,500 / 3,100 |
| 7 | `fanoutPerWrite 30, celebrityShare 0.03, celebrityMult 1000` | — | `hybridFanout` | custom `codeFixes.hybridFanout`, `serverStatus.fanoutBacklog == 0` for 60 s, `latencyChallenge(50,…)`, `incidentChallenge('spike')` | 3,000 / 3,750 |
| 8 | `writesPerUser 0.05`, larger disk pressure; `scaleOut.db` | idgen (+ db shards) | `idRanges` | `gs.dbCount() ≥ 3`, posts ≥ 10k with 0 clashes, `placedChallenge('idgen')` | 3,500 / 4,400 |
| 9 | `pageViewsPerUser, pageKB` (photos), `globalShare 0.6, distanceMs 120, edgeHitRate 0.85` | cdn | — | `placedChallenge('cdn')`, `latencyChallenge(80,5000)`, `profitChallenge` | 5,000 / 6,200 |

Fan-out params stay on for L7–L9.

`coinRate` per level from the balance tool (`≈ 2.5 × run / (0.3 × userTarget)`).

## 4. Game vs real numbers

| Thing | Game | Real |
|---|---|---|
| Read : write | 8:1 (L1) → 50:1 (L4+) | ~50:1 (Twitter 300K reads/s vs 6K tweets/s) |
| Feed window kept hot | ~2,000 rows (`archive`) | 200–800 post IDs per user |
| Feed cache hit rate | 92% | Twitter served home timelines from Redis only (~100%) |
| Spam | ~20 bot posts per real one | rate limits per account |
| Event batching | 50 → 1 write | 100s–1000s per batch |
| Users | 100 → 5,000 | 10M DAU → 2B users |
| Far-away share | 60%, +120 ms | global audience |

## 5. New mechanics needed

Three generic additions (all default to off; when absent every existing product's numbers are unchanged, checked by re-running the balance tool for guestbook / url_shortener / cloud_drive):

| Addition | Behaviour |
|---|---|
| `fanoutPerWrite` (level param, default 0) | Each real post costs N feed writes = `writes × N × (1 + celebrityShare × (celebrityMult − 1))`. **No queue:** inline: added to app CPU (per-write cost) and to cache writes (DB if no cache), and post latency grows with N. **Queue placed:** the writes go to queue load and are done by workers off the request path; post latency is flat; queue throughput limit → `fanoutBacklog` grows if exceeded |
| `celebrityShare` (default 0), `celebrityMult` (default 1000) | Share of posts from huge accounts; their fan-out is multiplied by `celebrityMult` |
| `hybridFanout` fix (toggle, `unlockLevel: Infinity`) | Celebrity posts skip fan-out (multiplier term drops out); each feed read adds a small merge cost (`+celebrityShare × k` DB/cache reads, ~+3 ms latency) |

Files to change:
- `js/game/SystemSimulator.js`: `trafficParams` (read the three params, default 0/1), `trafficFlow` (compute `fanoutWrites`, route inline vs queue, apply `hybridFanout`), `buildLoads` (app CPU, cache/DB writes, queue load), status: `serverStatus.fanoutBacklog`, `flows.fanout`.
- `js/game/GameState.js`: add keys to `trafficParams()`; `liveStats.feedWrites` (all three places) and `ResourceManager.tick` to count it.
- `tools/balance-levels.mjs`: add `fanoutPerWrite`, `celebrityShare`, `celebrityMult` to `PARAM_KEYS`.
- `js/data/codeFixes.js`: `hybridFanout` entry (toggle, cost ~1500); unlock in the pack's `fixes`.
- Explanations: `fanout` and `hybridFanout` keys; update `engine-capabilities.md`.
