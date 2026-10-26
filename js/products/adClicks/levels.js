/**
 * Ad click aggregator (like Google Ads / Meta Ads reporting) — the levels.
 *
 * Main source: Hello Interview "Design an Ad Click Aggregator" (study notes
 * in tools/designgame/library/26-ad-click-aggregator.md on v3), filled in
 * with ByteByteGo vol. 2 and public engineering posts (see
 * docs/products/ad-clicks.md).
 *
 *   1. First Click           — one server logs the click and redirects
 *   2. Ads Everywhere        — own database, an index on the ad ID
 *   3. Click Storm           — a message queue: log now, count in batches
 *   4. Slow Dashboards       — stream aggregation: counts per ad per minute
 *   5. Counted Twice         — a cache of signed impression IDs (dedup)
 *   6. Prime Time            — click processors behind a load balancer
 *   7. The Viral Ad          — split hot ads across queue partitions
 *   8. Never Lose a Click    — a data lake and nightly reconciliation
 *   9. Every Advertiser      — shard the counts by advertiser
 *
 * Traffic is "per online user per second"; `realWorld` notes give real numbers.
 */

// Every click is a lookup (which URL does this ad go to?) plus an event to count
const CLICKS = { readKind: 'lookup', appCallCost: 0.25, clickTracking: true };

export const AD_CLICKS_LEVELS = [
  {
    level: 1,
    name: 'First Click',
    subtitle: 'One server logs the click and redirects',
    intro: 'A small ad network starts as one machine that logs every click and sends people on.',
    mode: 'single-server',
    serverMode: true,
    userTarget: 100,
    userGrowthRate: 2,
    audience: 125,
    spikeRange: [1.2, 1.4],
    startingCoins: 500,
    coinRate: 25,
    ...CLICKS,
    readsPerUser: 0.15,
    writesPerUser: 0.01,
    reportPerUser: 0.002,
    reportCost: 0.5,
    unlockedComponentIds: ['monolith'],
    unlockedFeatures: ['Click and redirect', 'Advertiser dashboard'],
    feature: {
      name: 'Click, count, redirect',
      summary: 'A person clicks an ad; your server records the click and redirects them to the advertiser\'s site. Advertisers check how many clicks their ads got.',
      endpoints: [
        { method: 'GET', path: '/click/:adId', does: 'Record the click, then 302 to the advertiser', rate: 'readsPerSec' },
        { method: 'EVT', path: 'click event', does: 'One click to count', rate: 'clicksPerSec' },
        { method: 'POST', path: '/api/ads', does: 'An advertiser creates an ad', rate: 'writesPerSec' },
        { method: 'GET', path: '/api/metrics?adId&from&to', does: 'Clicks per minute for a time range', rate: 'reportsPerSec' }
      ]
    },
    realWorld: [
      'Redirecting from the server (log, then 302) captures every click; redirecting in the browser lets ad blockers skip the tracking call.',
      'Advertisers are billed per click, so the count is money: it must be complete and not double.'
    ],
    story: 'A small ad network: websites show your ads, people click them, and advertisers pay per click. One machine logs each click, redirects the visitor and answers advertisers\' dashboards. Grow to 100 users.',
    completionMessage: 'One server counts clicks for 100 users. But every ad and every click lives on it. Next: give the data its own database.'
  },

  {
    level: 2,
    name: 'Ads Everywhere',
    subtitle: 'Own database, an index on the ad ID',
    intro: 'Thousands of advertisers create ads, and each click looks its ad up by scanning them all.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 400,
    userGrowthRate: 4,
    audience: 500,
    startingCoins: 0,
    coinRate: 4.8,
    ...CLICKS,
    readsPerUser: 0.12,
    writesPerUser: 0.012,
    dbReadCost: 0.1,
    reportPerUser: 0.002,
    reportCost: 0.5,
    unlockedComponentIds: ['database'],
    unlockedFeatures: ['Database server', 'Index on ad ID'],
    realWorld: [
      'Google and Meta each serve millions of active ads; a click must find its ad\'s target URL in milliseconds.',
      'Raw clicks are written as rows: about 1,000 a second on average and 10,000 at peak in the Hello Interview numbers (≈100 million a day).'
    ],
    story: 'Advertisers love you: thousands of ads, and each click looks its ad up by scanning the whole table, on the same machine that runs your code. Move the data to its own database.',
    completionMessage: 'The database holds the ads, and the index finds each one directly. But each click is still a database write. Next: the click storm.'
  },

  {
    level: 3,
    name: 'Click Storm',
    subtitle: 'A message queue: log now, count in batches',
    intro: 'Every click is a database write inside the redirect, and clicks are pouring in.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 900,
    userGrowthRate: 8,
    audience: 1150,
    startingCoins: 0,
    coinRate: 4.9,
    ...CLICKS,
    readsPerUser: 0.2,
    writesPerUser: 0.004,
    dbReadCost: 0.05,
    reportPerUser: 0.002,
    reportCost: 0.5,
    unlockedComponentIds: ['message_queue'],
    unlockedFeatures: ['Message queue', 'Batched click counts'],
    realWorld: [
      'Click streams go into Kafka or Kinesis first: the click is safe once the log has it, and the redirect doesn\'t wait for the database.',
      'A Kinesis shard takes 1 MB/s or 1,000 records/s; streams are split by ad ID into many shards.'
    ],
    story: 'A big brand launched a campaign and clicks are pouring in. Each one is a database write the visitor waits for before the redirect. Drop clicks into a message queue and count them in batches.',
    completionMessage: 'The redirect returns at once; a worker reads clicks from the queue and writes one row per batch. Next: advertisers say their dashboards are slow.'
  },

  {
    level: 4,
    name: 'Slow Dashboards',
    subtitle: 'Stream aggregation: counts per ad per minute',
    intro: 'Each dashboard runs GROUP BY over millions of raw clicks.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1100,
    userGrowthRate: 10,
    audience: 1400,
    startingCoins: 0,
    coinRate: 4.5,
    ...CLICKS,
    readsPerUser: 0.2,
    writesPerUser: 0.004,
    dbReadCost: 0.03,
    reportPerUser: 0.012,
    reportCost: 3,
    unlockedComponentIds: [],
    unlockedFeatures: ['Stream aggregation (per ad, per minute)'],
    realWorld: [
      'GROUP BY over raw events collapses at 10,000 clicks a second. Batch jobs (Spark every few minutes) are cheaper but minutes behind.',
      'Stream processors like Flink keep a counter per ad per 1-minute window and flush every few seconds into an OLAP store (ClickHouse, Druid, BigQuery).'
    ],
    story: 'Advertisers watch their campaigns live, and each dashboard refresh counts clicks with GROUP BY over millions of raw rows. The database is drowning and dashboards take seconds. Pre-count the clicks as they stream past.',
    completionMessage: 'A stream processor keeps one counter per ad per minute; dashboards read a few rows. Next: some clicks are counted twice.'
  },

  {
    level: 5,
    name: 'Counted Twice',
    subtitle: 'A cache of signed impression IDs',
    intro: 'Double clicks, retries and replayed clicks are counted twice, and advertisers are billed for them.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1200,
    userGrowthRate: 10,
    audience: 1500,
    startingCoins: 0,
    coinRate: 4.3,
    ...CLICKS,
    readsPerUser: 0.18,
    writesPerUser: 0.004,
    dbReadCost: 0.05,
    reportPerUser: 0.012,
    reportCost: 3,
    dupShare: 0.08,
    unlockedComponentIds: ['redis_cache'],
    unlockedFeatures: ['Impression ID cache', 'Signed impression IDs'],
    realWorld: [
      'Deduplicating on (user, ad) needs logins and breaks retargeting, where one person should see an ad more than once.',
      'Instead each ad shown gets a unique impression ID, signed with an HMAC so it can\'t be forged; 100 million IDs × 16 bytes ≈ 1.6 GB in Redis.'
    ],
    story: 'An advertiser compared your bill with their own analytics: 8% too many clicks. Double clicks, browser retries and a click-replay scheme are all counted again. Give every ad view a signed impression ID and drop the repeats.',
    completionMessage: 'Each impression ID is counted once; forged ones fail the signature check. Next: prime time, and one click processor isn\'t enough.'
  },

  {
    level: 6,
    name: 'Prime Time',
    subtitle: 'Click processors behind a load balancer',
    intro: 'Evening traffic triples, and when the one click processor crashes, clicks are lost.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2400,
    userGrowthRate: 15,
    audience: 3000,
    startingCoins: 0,
    coinRate: 4.1,
    ...CLICKS,
    readsPerUser: 0.2,
    writesPerUser: 0.003,
    dbReadCost: 0.05,
    reportPerUser: 0.01,
    reportCost: 3,
    dupShare: 0.08,
    crashes: true,
    unlockedComponentIds: ['load_balancer'],
    unlockedFeatures: ['Load balancer', 'More click processors'],
    realWorld: [
      'Click processors are stateless: verify the signature, log the click, redirect. Any of them can take any click, so they auto-scale behind a load balancer.',
      'Ad traffic follows the day: peaks are often 5–10× the average.'
    ],
    story: 'Prime time: 2,400 users click at once, and one click processor can\'t keep up. When it crashes, the clicks in flight are gone, and so is the money. Scale out.',
    completionMessage: 'Stateless click processors share the load and cover for each other. Next: one ad went viral.'
  },

  {
    level: 7,
    name: 'The Viral Ad',
    subtitle: 'Split hot ads across queue partitions',
    intro: 'One ad gets a third of all clicks, and they all land in one queue partition.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2800,
    userGrowthRate: 15,
    audience: 3500,
    startingCoins: 0,
    coinRate: 3.9,
    ...CLICKS,
    readsPerUser: 0.2,
    writesPerUser: 0.003,
    dbReadCost: 0.05,
    reportPerUser: 0.01,
    reportCost: 3,
    dupShare: 0.08,
    crashes: true,
    hotShare: 0.3,
    unlockedComponentIds: [],
    unlockedFeatures: ['Salted keys for hot ads'],
    realWorld: [
      'Streams are partitioned by ad ID, so every click on one ad goes to the same partition and the same aggregation worker.',
      'For hot ads only, the key becomes AdId:0…N; the aggregator strips the suffix and SUM merges the partial counts.'
    ],
    story: 'A sneaker ad went viral during a big match: a third of all clicks are on that one ad. The queue splits clicks by ad, so one partition takes all of them while the rest sit idle. Spread the hot ad out.',
    completionMessage: 'The viral ad\'s clicks are spread over many partitions and summed back together. Next: some clicks quietly go missing.'
  },

  {
    level: 8,
    name: 'Never Lose a Click',
    subtitle: 'A data lake and nightly reconciliation',
    intro: 'Restarts and late events drop a few clicks from the live counts.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3200,
    userGrowthRate: 18,
    audience: 4000,
    startingCoins: 0,
    coinRate: 4.3,
    ...CLICKS,
    readsPerUser: 0.2,
    writesPerUser: 0.003,
    dbReadCost: 0.05,
    reportPerUser: 0.01,
    reportCost: 3,
    dupShare: 0.08,
    crashes: true,
    hotShare: 0.3,
    lossShare: 0.06,
    unlockedComponentIds: ['object_storage'],
    unlockedFeatures: ['Data lake (raw clicks)', 'Nightly reconciliation'],
    realWorld: [
      'Kafka keeps events for days, so a crashed aggregator can replay from a point in time. Late events after the window closes still slip through.',
      'The Lambda architecture: a fast stream layer for live counts plus a batch layer (raw events in S3, recounted by Spark) that corrects them.'
    ],
    story: 'Finance found that live counts run about 6% short of what the logs say: aggregators restart, and clicks that arrive late miss their minute. Advertisers are under-billed. Keep every raw click in a data lake and reconcile.',
    completionMessage: 'Live counts stay fast, and a batch job recounts the raw clicks and corrects them. Nothing is lost. Next: every advertiser in the world.'
  },

  {
    level: 9,
    name: 'Every Advertiser',
    subtitle: 'Shard the counts by advertiser',
    intro: 'Counts for millions of ads and dimensions outgrow one database.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 4000,
    userGrowthRate: 20,
    audience: 5000,
    startingCoins: 0,
    coinRate: 5.7,
    ...CLICKS,
    readsPerUser: 0.2,
    writesPerUser: 0.03,
    dbReadCost: 0.05,
    reportPerUser: 0.02,
    reportCost: 3,
    dupShare: 0.08,
    crashes: true,
    hotShare: 0.3,
    lossShare: 0.06,
    unlockedComponentIds: ['db_shard'],
    unlockedFeatures: ['Database shards (by advertiser)'],
    feature: {
      name: 'Counts by every dimension',
      summary: 'Advertisers slice clicks by ad, campaign, country and device, minute by minute. Each slice is another stored count row.',
      endpoints: [
        { method: 'GET', path: '/click/:adId', does: 'Record the click, then 302', rate: 'readsPerSec' },
        { method: 'EVT', path: 'click event', does: 'One click into the stream', rate: 'clicksPerSec' },
        { method: 'POST', path: 'count rows', does: 'Per-minute counts per ad and dimension', rate: 'writesPerSec' },
        { method: 'GET', path: '/api/metrics', does: 'Dashboards over any time range', rate: 'reportsPerSec' }
      ]
    },
    realWorld: [
      'Ad metrics have millions of ad IDs times many dimensions: high cardinality, which column stores (OLAP) handle better than time-series databases.',
      'Self-run ClickHouse is sharded by advertiser so one advertiser\'s dashboard reads one shard; daily and weekly rollups keep long ranges fast.'
    ],
    story: 'Advertisers now slice every count by campaign, country and device, every minute. The count rows outgrow one database, on disk and in writes. Split them across shards by advertiser.',
    completionMessage: 'Each advertiser\'s counts live on one shard, so dashboards read one machine and writes spread out. You built an ad click aggregator.'
  }
];
