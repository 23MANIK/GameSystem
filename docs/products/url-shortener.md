# URL Shortener (like bit.ly): level design

Code: `js/products/urlShortener/` (levels, challenges, tutorial, content). Balance check: `node tools/balance-levels.mjs url_shortener`.

## 1. What the real design discussions cover

Sources:
- ByteByteGo, *Design a URL Shortener* (System Design Interview, Vol. 1, ch. 8)
- Hello Interview, *Design Bitly*
- Write-ups from Exponent, AlgoMaster, DesignGurus, Codemia and system-design.space

| Topic | What they say | Real numbers |
|---|---|---|
| Requirements | Shorten a long URL, redirect a short one. Optional: custom alias, expiry, analytics | Redirect p99 under 100 ms; 99.99% availability; availability is preferred over consistency |
| Traffic | Very read-heavy | ByteByteGo: 100M new URLs/day ≈ 1,160 writes/s, 10:1 reads ≈ 11,600/s. Hello Interview: 100M DAU, 1000:1 reads, plan for 100× spikes |
| Storage | One row per link: code, long URL, created, expires | ByteByteGo: 365B rows × 100 B ≈ 36.5 TB over 10 years. Hello Interview: 1B × 500 B ≈ 500 GB |
| API | `POST /api/v1/shorten {longUrl}` → short URL; `GET /{code}` → redirect | — |
| 301 vs 302 | 301 is cached by browsers (less load, analytics lose clicks); 302 sends every click to you | Most shorteners that sell analytics use 302 |
| Short code | Hash + collision check (MD5/CRC32, keep 7 chars, retry with salt, Bloom filter); or Base62 of a unique ID | 62⁷ ≈ 3.5 trillion codes |
| Unique IDs | Auto-increment (single DB), Redis `INCR` counter, ticket server, Snowflake, key-generation service with pre-made keys; batch IDs per server | Each server takes 1,000 IDs at a time |
| Fast reads | Primary-key index on `short_code`; cache-aside (Redis, LRU); CDN / edge workers | Memory ~100 ns, SSD ~0.1 ms, HDD ~10 ms |
| Scale | Stateless app servers behind a load balancer; split read and write services; replicas; shard by code (consistent hashing) | — |
| Abuse | Rate-limit creation per IP / API key; scan for phishing and malware | Token bucket, `429 Too Many Requests` |
| Analytics | Emit click events to Kafka; aggregate asynchronously (Flink/Spark → ClickHouse) | The pipeline can outgrow the shortener |
| Expiry | `expires_at`, answer `410 Gone`, cleanup job or lazy delete; cache TTL ≤ expiry | — |

## 2. Problems → levels (easy to hard)

Related problems share a level, and unrelated ones get their own. Each level adds one new piece (or two tightly related ones).

| # | Level | Problem the player feels | New machine | New code fix / switch | Key challenge |
|---|---|---|---|---|---|
| 1 | First Short Link | One box must shorten and redirect | One server | — | 100 users, 300 links, < 60 ms, survive spike |
| 2 | Links Pile Up | Every redirect scans the whole table; every create checks "is this code taken?" | Database | Primary-key index, Base62 codes | 3,000 links, < 80 ms at 400 users |
| 3 | Spam Wave | Scripts create 30 spam links per real one: DB writes and disk fill | API gateway | — | Block 20k spam, < 1% errors, survive spam attack |
| 4 | Scale Out | 1,500 users; one server crashes = every link breaks | Load balancer (+ app servers) | Expire old links | 3 app servers, survive crash |
| 5 | Viral Links | Clicks jump; the same codes are read over and over; one DB | Cache | — | Hit rate ≥ 90%, DB CPU < 50%, < 45 ms |
| 6 | Click Analytics | `UPDATE clicks+1` on every redirect floods the DB | Message queue | — | Count 50k clicks, < 45 ms |
| 7 | Billions of Links | Disk and write limits of one DB; per-shard IDs clash | DB shards + ID generator | ID ranges | 3 shards, 10k links with no clashes |
| 8 | Go Global | 60% of clicks pay 120 ms; 301 is tempting but kills analytics | CDN (edge redirects) | 301 / 302 switch | < 80 ms at 5,000 users, clicks ≥ 95% counted |

Every level also has a profit goal, and most have a "survive an incident" goal (spike, spam attack or crash).

## 3. Game numbers vs real numbers

The game is scaled so things happen in minutes. Keep the ratios and orders of magnitude right:

| Thing | Game | Real (order of magnitude) |
|---|---|---|
| Read : write | 20:1 → 60:1 (spam excluded) | 10:1 – 1000:1 |
| Redirect response | 0.5 KB | ~300–500 B of headers |
| Cache hit rate | 93% | 90%+ (skewed popularity) |
| Edge hit rate | 80% | 70–95% for popular links |
| Click batching | 50 events → 1 DB write | 100s–1000s per batch |
| Rate limiting | blocks 95% of spam | per-key token buckets |
| Disk "space" | 1,500–20,000 links per disk | 100s of GB – TB per node |

Each level's `realWorld` notes (shown in Goals → "In the real world") give the real figures and services. The Levels tab's blueprint maps every machine to AWS / GCP services and copies the design as JSON.

## 4. Simulator features this product added

All of these are generic, so later products can reuse them. They are set as level params in `levels.js`:

| Param | What it does |
|---|---|
| `readKind: 'lookup'` | Reads fetch one row by key (tiny, fixed response) instead of "read everything" |
| `appCallCost` | App CPU per API call |
| `botKind: 'write'`, `spamPerUser` | Bots create records (spam) instead of scraping |
| `cacheHitRate`, `edgeHitRate` | Product-specific hit rates |
| `clickTracking` | Every read is also an event to record (inline DB write, or queue + batch) |
| `keepRecords` | Rows kept once expiry is on (write rate × lifetime) |
| `audience` | Growth stops here, so players can build headroom |

There are also two new machine roles (`idgen`, `queue`), database shards (`scaleOut.db`), and switch-style code fixes (`toggle: true`).
