# 21 · YouTube Top K Videos: Study Notes

**Difficulty:** Hard · **Patterns:** Scaling Writes, Scaling Reads, Big-data structures · **Source:** https://www.hellointerview.com/learn/system-design/problem-breakdowns/top-k
*My own summary of the Hello Interview breakdown. Read the original for diagrams and full detail.*

## Context
- There are many variants of this question. Follow the interviewer's lead and adapt.
- **Input:** a firehose of videoId view events (about 70B views a day).
- **Goal:** the exact top K for the last 1 hour, 1 day, 1 month, and all time.

## Requirements
**Windows:**
- **Sliding:** [T−1h, T].
- **Tumbling:** the last full hour, e.g. 9:00–10:00.
- **Propose tumbling** (easier) and give the interviewer a chance to object.

**Functional:** top K for all time and for tumbling 1h/1d/1mo windows, **K ≤ 1000**.
**Out of scope:** arbitrary time ranges or start points.

**Non-functional**
- Views must count within **1 minute** of happening
- **Exact counts** (approximation comes later as a deep dive)
- **Responses in tens of milliseconds**, which forces precomputation
- Huge write volume and a huge number of videos

## Core entities and API
- **Entities:** Video, View, TimeWindow.
- **API:** `GET /views/top-k?window=&k=` → [{videoId, views}]. No pagination because K is capped.

## High-level design
- Assume a **Kafka ViewEvent topic partitioned by videoId** already exists, which skips a lot of boilerplate.
- **v1:**
  - A consumer increments counters in Postgres.
  - An index on views gives `ORDER BY views DESC LIMIT k` in O(k).
  - Writes now cost O(log n) for the index update.
- **Windows:** add an hour column, then `SUM ... GROUP BY ... WHERE ts in window`. That's a huge scan. Earmark it.

## Deep dives
### 1. Fewer reads hitting the database
- **Good: cache** each `top-k:{window}:{ts}` with a TTL.
  - On expiry there's a stampede and SLA misses. Coalescing helps with the stampede but not the latency.
- **Great: a cron precomputes the top K per window and warms the cache.**
  - Reads never touch the database.
  - Keep stale entries around in case the cron runs late.

### 2. Massive writes
- **Estimates:**
  - 70B ÷ 100k seconds = **700k writes a second**.
  - About 1M new videos a day, so ~3.6B over 10 years; **64GB** just for (id, count).
- **Shard** along the Kafka partition key (videoId).
  - About 70 shards at 10k writes a second each.
  - Read the top K from each shard and merge; the global top K is guaranteed to be in the union.
- **Batch with Flink:**
  - Use a bounded out-of-orderness watermark (~30s for late events) with 1-hour tumbling windows.
  - Popular videos collapse into one write per hour, 2–100x fewer writes, so about 5–10 shards.
  - Flink checkpoints let it rewind Kafka after a failure.

### 3. Fast window queries
- Summing hundreds of GB is slow, and Spark just throws hardware at it. At senior+ levels, **simplify the problem**.
- **Good: coarser rollups** (hour → day → month) through cron or extra Flink windows. Adds lag and extra database load.
- **Great: keep one aggregate table per window** (VideoViewsLastHour, LastDay, LastMonth, AllTime), each with an index on views, so the top K read is O(k).
  - Now there are 4 writes per batch.
  - Tune with unlogged tables, deferred fsync and the right batch size.
- **Great, with caveats: do it all in Flink.**
  - Keyed state in RocksDB, rolling window aggregator → top-K heap → Redis sink. No Postgres.
  - Requires deep Flink knowledge, so it's risky in an interview.

### 4. Sliding windows
- Aggregate per minute, then **add the latest minute and subtract the minute from T−60**.
- More reads and updates, and you must keep a month of minute-grain data.
- **A mature compromise:** sliding window for "last hour" only, tumbling for day and month.
- **Alternative:** a second **lagged consumer group** that decrements expired views. Needs a month of Kafka retention but no minute-grain table.
- Flink's native sliding windows with a 1-minute slide would multiply state by about 43,200x.

### 5. Approximation
- **Count-Min Sketch** (CMS):
  - A grid of hash-indexed counters giving an upper-bound estimate in roughly hundreds of MB instead of 100+ GB.
  - No list operation, so **pair it with a heap or ZSET** trimmed to 1000 entries:
    1. `add` the view.
    2. `estimate` its count.
    3. Push into the heap.
- **Good:** Redis `CMS.INCRBY` + `ZADD`. Durability is weak because the sketch and the ZSET can't be lined up with Kafka offsets.
- **Great:** CMS and heap in Flink state, checkpointed.
- **Sliding windows:** CMS can also decrement when you only remove what you added (Redis lacks DECRBY). Beyond interview scope.

### 6. Specialized databases
- **Bad: InfluxDB or Prometheus.** Billions of videoId series is too high a cardinality, and top() turns into scans.
- **Good: TimescaleDB** with hypertables plus **continuous aggregates** per window. Basically the same design, still needs a cache.
- **Good: real-time OLAP** (Druid rollups, Pinot star-trees, ClickHouse SummingMergeTree materialized views). Be ready to explain how ingestion works internally.
- **Advice:** master the primitives rather than name-dropping technologies.

## Architecture diagram (my own drawing)
```mermaid
flowchart LR
  K[[Kafka ViewEvents<br/>partitioned by videoId]] --> F[Flink<br/>watermark 30s, hourly tumbling<br/>(+ CMS heap optional)]
  F -->|batched upserts| S1[(Postgres shard 1<br/>LastHour/LastDay/LastMonth/AllTime<br/>indexed by views)]
  F --> S2[(Postgres shard N)]
  CRON[Top-K cron<br/>merge top K from each shard] --> S1 & S2
  CRON --> R[(Redis cache top-k:window:ts)]
  C[Clients] --> LB[LB] --> TK[Top-K Service] --> R
```

## Key takeaways
- Pin down the window semantics first.
- Precompute + cache to hit tens of milliseconds.
- Shard on the stream key; the union of per-shard top K contains the global top K.
- Batch with stream processing.
- One table per window.
- CMS + heap when approximate answers are acceptable.

## Game-design hooks
- Trending leaderboards (hourly, daily, monthly, all-time).
- "Hot right now" lists built with a lagged decrement.
- CMS-based "most played levels" at scale.
