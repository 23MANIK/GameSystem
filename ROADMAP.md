# Scale Architect — Roadmap

## Big idea: many products, each with its own levels

Before the game starts, the player picks **one product** to build. Each product is a classic system design interview problem (ByteByteGo / Grokking style):

| Product | Like | Status |
|---|---|---|
| Guestbook (tutorial) | — | Levels 1–7 playable |
| URL Shortener | bit.ly | Levels 1–8 playable |
| News Feed / Posts | Twitter, Instagram | Locked |
| Cloud Drive | Google Drive, Dropbox | Levels 1–11 playable |
| Chat App | WhatsApp, Messenger | Locked |
| Video Streaming | YouTube | Locked |
| Ride Hailing | Uber | Locked |

### Levels and challenges
- Every product has its own levels. Each level has a list of **challenges** to complete, for example:
  - reach N users (e.g. 1,000)
  - store N items / N GB
  - keep latency under N ms
  - ship a feature
  - stay profitable
- Each challenge shows an **obvious hint** for now (smarter hints later).
- Completing **all** challenges completes the level → congratulations screen → next level unlocks.
- New levels unlock new components and new features, and force you to upgrade the system.
- Levels not built yet are shown **locked**.

### Economy
- Users bring **revenue**; the system has a **running cost** (every server part costs coins over time).
- Earnings = revenue − cost. Completing a level shows stats: average users, estimated daily active users, revenue, cost, profit.

## Done
- **Create DesignGame (branch v3).** Name a system; Claude researches it, builds levels as a data pack, test-plays them and the game shows up under Community games. Passcode-only creation. See `docs/designgame/README.md`.
- **Guestbook, 7 levels.** Each adds one piece and one difficulty:

  | Level | New piece | New difficulty |
  |---|---|---|
  | 1 The Garage | One server (CPU / RAM / Storage / Network) | Grow to 100 users |
  | 2 Separate the Database | Database server; code fixes: pagination, index | Data grows fast, disk fills |
  | 3 Split the UI | Web (UI) server; archive fix | Heavy 300 KB pages |
  | 4 Guard the Door | API gateway with rate limiting | Bots and scrapers, bot attacks |
  | 5 Scale Out | Load balancer + up to 6 app servers; XL parts | 1,500 users, app server crashes |
  | 6 Cache It | Cache | Read-heavy traffic on one database |
  | 7 Go Global | CDN | 60% of users far away (+120 ms) |
- Guided walkthrough for every level, challenges with hints, (i) explanations.
- Economy: running cost, lost revenue, outage penalties, reputation, funding rounds (angel → IPO) based on daily users and profit per minute.
- Incidents: traffic spikes, bot attacks, app server crashes.
- Product picker with locked products; finished levels pause; Alerts tab.
- Architecture-diagram view (`js/rendering/SystemDiagram.js`): tiers, labelled arrows with live rates, animated requests that slow, queue, time out and drop; bots bounce off the gateway.
- Simulation model in `js/game/SystemSimulator.js`; machines in `js/data/roles.js`; levels in `js/data/levels.js`; goals in `js/game/Challenges.js`.

- **URL Shortener, 8 levels** (design doc: `docs/products/url-shortener.md`):

  | Level | New piece | New difficulty |
  |---|---|---|
  | 1 First Short Link | One server | Shorten + redirect, 100 users |
  | 2 Links Pile Up | Database; primary-key index, Base62 codes | Every redirect scans the table; collision checks |
  | 3 Spam Wave | API gateway | Spam scripts create links, fill the disk |
  | 4 Scale Out | Load balancer + app servers; link expiry | 1,500 users, crashes |
  | 5 Viral Links | Cache | Hot links read over and over |
  | 6 Click Analytics | Message queue | A DB write per click |
  | 7 Billions of Links | DB shards + ID generator; ID ranges | Disk and write limits; clashing codes |
  | 8 Go Global | CDN edge redirects; 301/302 switch | Far-away users; analytics vs load |
- **Cloud Drive, 11 levels** (design doc: `docs/products/cloud-drive.md`, base source Hello Interview "Design Dropbox"): one server → blob storage + metadata DB → pre-signed URLs → gateway + LB + chunked uploads → server-side chunk checks → dedup → shares table + cache → sync server + delta sync → versions/conflicted copies → cold tier + metadata shards → CDN.
- Product packs (`js/products/`): each product brings its levels, goals, tutorial, texts and incidents; `registry.js` switches the game to it.
- Levels tab (roadmap + blueprint with AWS/GCP equivalents, copy as JSON); Goals tab shows "Up next" and "Completed".
- Money balance (both products): each funding round is sized to the next stage (1.5k → 20k) and scaled by users, profit margin and reliability; revenue per level is ~2.5× the cheapest working system's running cost, so oversized systems eat your profit.
- `tools/balance-levels.mjs <product>`: checks each level is beatable and needs its new piece.
- Skill `.claude/skills/design-product-levels`: the workflow for adding the next product (research → levels → pack → balance → play-test).

## Later
- Real levels for each locked product (use the design-product-levels skill).
- Smarter hints (only after the player is stuck for a while).
- More Guestbook levels: read replicas, message queues, sharding, multi-region.
- Daily cycle (traffic peaks at certain hours).
