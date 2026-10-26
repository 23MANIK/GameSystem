# Ticket Booking (like Ticketmaster): level design

Difficulty on the picker: **Medium** (Hello Interview rates it Medium).

## 1. What the real design discussions cover

Sources:
- Hello Interview, *Design Ticketmaster* (main source; Nikhil's study notes in `tools/designgame/library/05-ticketmaster.md` on v3): https://www.hellointerview.com/learn/system-design/problem-breakdowns/ticketmaster
- Ticketmaster's statement on the Eras Tour presale (Nov 2022), as reported by Rolling Stone: https://www.rollingstone.com/music/music-news/ticketmaster-cancels-general-on-sale-taylor-swift-the-eras-tour-1234632678/
- ByteByteGo / Alex Xu, *Hotel reservation system* (Vol. 2), for the reserve-then-confirm pattern (from memory, unverified)

| Topic | What they say | Real numbers |
|---|---|---|
| Requirements | View events with a seat map, search events, book tickets. Out: dynamic pricing, admin tools | Search under 500 ms |
| CAP | Availability for browsing and search; strong consistency for booking (no double booking) | — |
| Traffic | Read-heavy; huge spikes on popular on-sales | ~100:1 views to bookings; 10M users on one event |
| Data | Event, Venue (seat map), Performer, Ticket (one per seat, with status), Booking. One Postgres: data is coupled and booking needs ACID | 20,000-seat arena = 20,000 ticket rows per show |
| API | `GET /events/:id`, `GET /events/search?keyword&start&end&page`, `POST /bookings/:eventId` (later split into reserve + confirm) | — |
| Seat holds (core deep dive) | Bad: `SELECT FOR UPDATE` for the whole checkout. Good: status + expiry swept by cron. Great: implicit status (RESERVED with an expiry in the past counts as free), or a Redis lock `SET ticket user NX EX 600` | 10-minute hold |
| Payments | Stripe PaymentIntent, webhook confirms; webhook must be idempotent on bookingId | — |
| Scaling views | Cache event / venue / performer as eventId → object; long TTL for static data, short for availability; stateless event service behind a load balancer | — |
| Massive demand | SSE seat updates get chaotic; best: a virtual waiting queue (Redis sorted set by join time), admit in batches, booking service rejects non-admitted users | Eras Tour presale: ~14M users/bots, 3.5B system requests, 4× the previous peak |
| Search | `LIKE '%x%'` is a full scan. Good: B-tree + query tuning. Great: full-text (Postgres GIN) or Elasticsearch kept in sync by CDC | — |
| Search caching | Cache by query params with a TTL; Elasticsearch caches; CDN for non-personalized results | — |
| Bots | API gateway does auth and rate limiting | — |

### Order a real system adds components
1. One server, one database: events, tickets, bookings in one transaction.
2. Index tickets by (event, seat).
3. Reserve-then-confirm with expiring holds.
4. API gateway with rate limiting.
5. Stateless services behind a load balancer; archive past shows.
6. Redis cache for event data.
7. Search index (Elasticsearch + CDC).
8. Virtual waiting room for the biggest on-sales.

## 2. Problems → levels (easy to hard)

| # | Level | Problem the player feels | New machine | New code fix / switch | Key challenge |
|---|---|---|---|---|---|
| 1 | First Show | One server does everything | app | – | Vertical scaling |
| 2 | Thousands of Seats | Ticket rows pile up, seat maps scan them | db | index | Own DB + index |
| 3 | Sold Twice | Two fans buy the same seat; refunds | – | holds | Seat holds (reserve → confirm) |
| 4 | Scalper Bots | Bots reload seat maps 2–3× per fan | gateway | – | Rate limiting |
| 5 | Big Night Out | 100:1 browsing, crashes | lb | archive | Horizontal scaling |
| 6 | Same Page, Every Fan | Same event pages hit the DB | cache | – | Read-heavy caching |
| 7 | Find the Show | `LIKE '%…%'` scans every event | – | searchIndex | Full-text search |
| 8 | The Mega On-Sale | Everyone presses "book" at 10:00 | queue (waiting room) | – | Waiting room |

## 3. Engine mapping

New generic level params (in `SystemSimulator.trafficParams`, `GameState.trafficParams`, `PARAM_KEYS`):
- `clashShare`: share of bookings that grab a seat someone else is paying for. Adds `clashShare × writeShare` to the error rate unless the `holds` fix is owned; with holds each booking is 1.5 writes (reserve + confirm). Status: `clashShare`, `clashPerSec`; live stats `clashedBookings`, `safeBookings`.
- `searchPerUser` (+ `searchCacheHit`, default 0.5): searches that hit the cache first, then the DB at `0.5 + rows/2000` CPU (0.08 with `searchIndex`); adds search latency that grows with rows.
- `rushPerUser`: on-sale "book now!" presses. Without a queue each costs 1.5 DB CPU (seat-lock checks) and app CPU; with a queue they wait in it (RAM per fan). Live stat `fairQueued`.

Goals: helpers plus `liveStats.safeBookings`, `liveStats.botsBlocked`, `liveStats.fairQueued`, `cpuAtUsers(gs, 'db', n)`.

## 4. Game vs real numbers
Ratios kept: browsing ≫ booking, bots a few × real traffic, searches a small share of calls, the on-sale stampede large next to normal bookings. Absolute users scaled to hundreds–thousands so each level takes ~4–10 minutes.

## 5. New mechanics
The three params above, plus two code fixes (`holds`, `searchIndex`) and the waiting-room wording on the diagram when a level has `rushPerUser`. Guestbook numbers unchanged (test suite).
