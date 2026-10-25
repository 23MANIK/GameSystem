# 20 · Notification System (Internal Platform): Study Notes

**Difficulty:** Medium · **Patterns:** Multi-step Processes, Scaling Writes · **Source:** https://www.hellointerview.com/learn/system-design/problem-breakdowns/notification-system
*My own summary of the Hello Interview breakdown. Read the original for diagrams and full detail.*

## Requirements
The customers are **internal teams** (auth OTPs, marketing blasts).

**Functional**
- Send to one user by push, email or SMS, now or scheduled
- **Campaigns** sent to a segment, now or scheduled
- User preferences (opt out per channel, quiet hours)

**Out of scope:** templates, analytics, in-app feed, frequency caps.

**Non-functional**
- **At-least-once delivery with best-effort dedup** (sending twice beats never sending)
- Surges of **~5k a second**. 10M a day averages only ~100 a second, but a 1M campaign in 5 minutes is over 3k a second.
- **High priority (OTPs, security) delivered within 5 seconds** even during a surge
- **Two traffic classes:** small and latency-critical vs bulk and delay-tolerant. Mixing them is the heart of the problem.

## Core entities
- Notification: one message, one user, one channel, with a status
- Campaign: a definition that fans out into notifications (like job vs execution)
- Segment: an audience, maintained elsewhere
- User: preferences, contact info and device tokens

## API
- `POST /notifications {userId, channel, priority, content, scheduledAt?, idempotencyKey}` → 202 `{id}`
- `GET /notifications/{id}` → status
- `POST /campaigns {segmentId, channel, priority, templateId, scheduledAt?, idempotencyKey}` → 202
- `PUT /users/{id}/preferences {optOuts, quietHours}`. userId in the path is fine because callers are trusted services with API keys.
- `PUT /users/{id}/devices {platform, pushToken}`. The app sends its push token on login and whenever it rotates.

## High-level design
- **Path:** API Gateway (API keys + rate limits) → Notification Service → Postgres → provider (email/SMTP, Twilio, APNs/FCM).
- **We're a router and a bookkeeper,** not the last-mile carrier. Don't design sockets to phones.
- **Scheduling:** rows marked SCHEDULED plus a cron every minute. OTPs skip it.
- **Campaigns:** the cron finds due campaigns, snapshots the segment, fans out and marks complete.
  - A snapshot means people who join mid-send miss it. Saying so out loud is a senior signal.
- **Preferences** are checked right before the provider call.
  - Suppressed sends are logged **SUPPRESSED with a reason**.
  - Quiet hours don't apply to high priority.
- **Problems with v1:**
  - The provider call sits in the request path, and a crash loses the notification.
  - Campaigns starve OTPs.
  - A single host runs the fan-out.

## Deep dives
### 1. Never drop an accepted notification
- **Bad: retry inside the request.** Retries live in memory, deploys lose them, callers time out, and the result is effectively **at-most-once**.
- **Good: write durably, then poll.**
  - Write a PENDING row, return 202, and have dispatchers poll.
  - You've built a mediocre queue in Postgres: `FOR UPDATE SKIP LOCKED`, home-made retries, table bloat, and latency bounded by the poll interval.
- **Great: publish to a durable queue first (SQS).**
  - Accept = enqueue, then 202.
  - **Worker flow:**
    1. Receive the message (visibility timeout hides it).
    2. Look up contact details and check preferences.
    3. Call the provider.
    4. Write the outcome row.
    5. *Then* delete the message.
  - Backoff and a DLQ come built in.
  - **Avoid "write the DB, then publish":** it's a dual write. The outbox pattern fixes it, but it isn't needed here.
  - Kafka's advantage is replay after a bad deploy, which isn't required here.

### 2. OTPs within 5 seconds during a 1M blast (the crux)
- At 5k a second, 1M queued messages take about 200 seconds, so an OTP behind them is far too slow.
- **Bad: autoscale workers.** You'd need about 200k sends a second, which runs into cold starts, account limits and huge cost.
- **Good: a separate queue per priority.**
  - Provider rate limits and workers are still shared, so standard traffic can still starve OTPs.
- **Great: isolated worker pools plus provider budgets per tier.**
  - A **Redis token bucket**: of Twilio's 1000 a second, **100 are reserved for high priority** and standard gets the other 900.
  - High priority has its own worker pool. It sits idle on purpose.
- **Provider brownouts** (p99 jumps to 30s):
  - **Circuit breaker:** fail fast and shed standard traffic.
  - **Bulkhead:** cap in-flight calls per provider.
  - **Provider router:** a backup provider, or a fallback channel such as email for login codes.

### 3. Dedup on top of at-least-once
- **Sources of duplicates:** a worker crashes after sending but before deleting; callers retry; the campaign cron re-runs.
- **Stable IDs:**
  - Derive the notification ID from the caller's idempotency key.
  - Campaign messages get `campaignId:userId`, and campaigns need their own idempotency key.
- **Good: claim with `SET NX` before sending.**
  - **Bug:** if the worker crashes after claiming, every redelivery is skipped, which turns delivery into **at-most-once**.
- **Great: check before, record after.**
  - `GET sent:{id}` before sending.
  - `SET sent:{id} EX 48h` only after the provider accepts.
  - The database is the source of truth behind Redis.
  - A rare duplicate remains possible (the provider accepted, then the worker crashed) and is accepted, because drops are worse.
  - If Redis is down, fall back to the outcome table; if that's down too, send anyway and alert.
- **Name the semantics honestly:** exactly-once stops at the provider, so the design is at-least-once plus dedup at each entry point.

### Extra follow-ups
Per-user send-time optimization (ML), frequency capping (counters), cancelling a campaign mid-send, timezone-aware "9am local" delivery.

## Architecture diagram (my own drawing)
```mermaid
flowchart LR
  US[Upstream services] --> GW[API Gateway<br/>API keys, rate limits]
  GW --> NS[Notification Service]
  NS -->|high| QH[[SQS high-priority]]
  NS -->|standard| QS[[SQS standard]]
  NS --> CDB[(Campaigns)]
  CRON[Scheduler cron] --> CDB
  CRON -->|fan-out campaignId:userId| QS
  QH --> WH[High-priority worker pool]
  QS --> WS[Standard worker pool]
  WH & WS --> TB[(Redis token buckets<br/>reserved 10% high)]
  WH & WS --> DD[(Redis sent:{id} dedup)]
  WH & WS --> PG[(Postgres outcomes, users, prefs, devices)]
  WH & WS -->|circuit breaker / bulkhead| PROV[Email / Twilio / APNs-FCM]
  QH & QS -.-> DLQ[[DLQ]]
```

## Key takeaways
- Accept by durable enqueue and return 202.
- Isolate priority tiers end to end: queues, workers and provider quota.
- Idempotency keys + check-before/record-after dedup.
- Circuit breakers and bulkheads for flaky third-party providers.

## Game-design hooks
- Push and notification design for player re-engagement, with quiet hours and opt-outs.
- Priority lanes for critical game events.
- Dedup of reward notifications.
