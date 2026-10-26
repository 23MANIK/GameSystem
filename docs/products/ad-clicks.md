# Ad Click Aggregator (like Google Ads reporting): level design

Difficulty on the picker: **Hard** (Hello Interview rates it Hard).

## 1. What the real design discussions cover

Sources:
- Hello Interview, *Design an Ad Click Aggregator* (main source; Nikhil's study notes in `tools/designgame/library/26-ad-click-aggregator.md` on v3): https://www.hellointerview.com/learn/system-design/problem-breakdowns/ad-click-aggregator
- AWS, Kinesis Data Streams quotas (1 MB/s or 1,000 records/s write per shard): https://docs.aws.amazon.com/streams/latest/dev/service-sizes-and-limits.html
- ByteByteGo / Alex Xu, *Ad Click Event Aggregation* (Vol. 2, ch. 6), from memory, unverified

| Topic | What they say | Real numbers |
|---|---|---|
| Requirements | Click redirects to the advertiser; advertisers query clicks per minute. Out: targeting, serving, fraud | Queries under 1 s; never lose a click; idempotent |
| Traffic | Bursty click stream | 10M active ads; ~1k clicks/s average, 10k peak (≈100M/day) |
| Redirect | Client-side redirect can be bypassed; server-side (log, then 302) captures every click | — |
| Making queries fast | Bad: GROUP BY raw events. Good: raw events in Cassandra + Spark batches into OLAP (minutes late). Great: Kafka/Kinesis → Flink 1-minute windows, flushed every few seconds → OLAP | ~3M events / 300 MB per 5-minute batch |
| Scaling | Auto-scaled click processors behind an LB; stream sharded by AdId; OLAP sharded by advertiser | Kinesis shard: 1 MB/s or 1k records/s |
| Hot ads | A viral ad overloads one partition | Salt hot keys `AdId:0..N`, strip and SUM downstream |
| Never lose clicks | Stream retention (days) for replay; checkpointing arguably unneeded for 1-minute windows; reconcile with raw events in S3 + Spark (Lambda architecture) | — |
| Duplicates | Dedup on (user, ad) breaks retargeting; use a signed impression ID, dedup in Redis before the stream | 100M × 16 B ≈ 1.6 GB |
| Long ranges | Daily / weekly rollup tables | — |

### Order a real system adds components
1. One server logs clicks and redirects.
2. Database with an index on ad ID.
3. Click stream (Kafka/Kinesis) and batch writer.
4. Stream aggregation (Flink) into per-minute counts.
5. Impression-ID dedup cache (Redis).
6. Stateless click processors behind a load balancer.
7. Salted keys for hot ads.
8. Raw events to a data lake + reconciliation job.
9. Sharded OLAP store by advertiser.

## 2. Problems → levels (easy to hard)

| # | Level | Problem the player feels | New machine | New code fix / switch | Key challenge |
|---|---|---|---|---|---|
| 1 | First Click | One server logs and redirects | app | – | Vertical scaling |
| 2 | Ads Everywhere | Each click scans every ad | db | index | Own DB + index |
| 3 | Click Storm | Inline click writes slow redirects | queue | – | Async logging, batching |
| 4 | Slow Dashboards | GROUP BY over raw clicks | – | rollups | Stream aggregation |
| 5 | Counted Twice | 8% duplicate clicks billed | cache | dedupIds | Idempotency keys |
| 6 | Prime Time | Peak traffic, crashes | lb | – | Horizontal scaling |
| 7 | The Viral Ad | One partition takes 30% of clicks | – | saltKeys | Hot partitions |
| 8 | Never Lose a Click | Live counts ~6% short | blob (data lake) | reconcile | Lambda architecture |
| 9 | Every Advertiser | Count rows outgrow one DB | db shards | – | Sharding |

## 3. Engine mapping

Built on the URL shortener's `clickTracking` (reads are clicks, each one an event; inline DB write, or queue + batch of 50). New generic params:
- `reportPerUser`, `reportCost`: dashboard queries; each costs `reportCost` DB CPU and up to `100 × reportCost` ms, unless `rollups` is owned and a queue is placed (then 0.05 CPU, 2 ms, plus stream work on the queue).
- `dupShare`: duplicate clicks lower `clickAccuracy` by that share unless a cache is placed and `dedupIds` is owned (cache CPU and RAM per click).
- `hotShare`: queue CPU for clicks × (1 + 60 × hotShare) unless `saltKeys` is owned.
- `lossShare`: clicks lost from the live count (`clickAccuracy × (1 − lossShare)`) unless blob storage is placed and `reconcile` is owned. Without files, blob storage is a data lake fed from the queue.

Goals use `serverStatus.clickAccuracy`, `liveStats.clicksCounted` and the new `liveStats.accurateClicks` (clicks counted while accuracy ≥ 99%).

## 4. Game vs real numbers
Clicks ≫ new ads ≫ dashboard queries, duplicates and losses a few percent, one viral ad a third of the traffic. Users scaled to hundreds–thousands for ~4–12 minute levels.

## 5. New mechanics
The four params above, four code fixes (`rollups`, `dedupIds`, `saltKeys`, `reconcile`), a non-file data-lake load on the blob role, and diagram labels for it ("Data lake", raw clicks edge from the queue). Guestbook numbers unchanged.
