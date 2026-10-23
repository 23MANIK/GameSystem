/**
 * News feed (like Twitter / Instagram) — the levels.
 *
 * Sources: ByteByteGo "Design a News Feed System", Hello Interview "Design a
 * News Feed", Twitter timeline talks (see docs/products/news-feed.md).
 *
 *   1. Hello, Posts          — one server stores posts and builds feeds
 *   2. The Feed Gets Slow    — own database, cursor pagination, (author, time) index
 *   3. Spam Accounts         — API gateway rate-limits posting
 *   4. Everyone Scrolls      — app servers behind a load balancer, hot feed window
 *   5. Precomputed Feeds     — feed cache: one list lookup per scroll
 *   6. Background Fan-out    — message queue + fan-out workers
 *   7. Celebrity Problem     — hybrid fan-out
 *   8. Billions of Posts     — DB shards + ID generator
 *   9. Photos Worldwide      — CDN
 *
 * Traffic is "per online user per second"; `realWorld` notes give real numbers.
 */

// Once feeds are precomputed, a scroll is one list lookup in the cache
const FEED_LIST = { readKind: 'lookup', appCallCost: 0.3 };
const FANOUT = { fanoutPerWrite: 30 };
const CELEBS = { celebrityShare: 0.03, celebrityMult: 1000 };

export const NEWS_FEED_LEVELS = [
  {
    level: 1,
    name: 'Hello, Posts',
    subtitle: 'One server stores posts and builds feeds',
    intro: 'Every social network starts as one machine that stores posts and builds feeds.',
    mode: 'single-server',
    serverMode: true,
    userTarget: 100,
    userGrowthRate: 2,
    audience: 125,
    spikeRange: [1.2, 1.4],
    startingCoins: 500,
    coinRate: 25,
    readKind: 'all',
    readsPerUser: 0.1,
    writesPerUser: 0.01,
    unlockedComponentIds: ['monolith'],
    unlockedFeatures: ['Post', 'Follow', 'Home feed'],
    feature: {
      name: 'Post and scroll',
      summary: 'Users post short updates and follow each other. The home feed shows the newest posts from everyone you follow.',
      endpoints: [
        { method: 'POST', path: '/api/posts', does: 'Publish a post', rate: 'writesPerSec' },
        { method: 'GET', path: '/api/feed', does: 'Newest posts from people you follow', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Feeds are read far more than posts are written: about 8:1 here, ~50:1 at Twitter (300K timeline reads/s vs 6K tweets/s).',
      'A $20/month VM running the app and PostgreSQL together serves a small community of a few thousand people.'
    ],
    story: 'A tiny social network: people post, follow friends and scroll a feed. One machine stores every post and builds each feed on request. Open it up and grow to 100 users.',
    completionMessage: 'One server stores posts and builds feeds for 100 users. But each feed load reads every followee\'s posts, and the posts keep piling up. Next: the feed gets slow.'
  },

  {
    level: 2,
    name: 'The Feed Gets Slow',
    subtitle: 'Own database, cursor pagination, an index',
    intro: 'Every feed load scans every followee\'s posts and returns all of them.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 400,
    userGrowthRate: 4,
    audience: 500,
    startingCoins: 0,
    coinRate: 6,
    readKind: 'all',
    readsPerUser: 0.15,
    writesPerUser: 0.01,
    dbReadCost: 0.15, // merging followees' posts
    unlockedComponentIds: ['database'],
    unlockedFeatures: ['Database server', 'Cursor pagination', 'Index on (author, time)'],
    feature: {
      name: 'Infinite scroll',
      summary: 'The feed is built by merging the posts of everyone you follow, newest first. Without limits, every load returns every post.',
      endpoints: [
        { method: 'POST', path: '/api/posts', does: 'Publish a post', rate: 'writesPerSec' },
        { method: 'GET', path: '/api/feed?cursor=…', does: 'Next page of the feed', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Feeds use cursor pagination ("posts older than this ID"), not page numbers: new posts arriving at the top don\'t shift the pages.',
      'An index on (author_id, created_at) lets the database read only the newest posts of each followee.'
    ],
    story: 'Posts pile up by the thousand. Each feed load scans every followee\'s posts and sends all of them, and the server\'s disk is filling. Give the posts their own database.',
    completionMessage: 'The database holds the posts; feeds return one page at a time, and the index finds each followee\'s newest posts directly. Next: someone found your API.'
  },

  {
    level: 3,
    name: 'Spam Accounts',
    subtitle: 'An API gateway rate-limits posting',
    intro: 'Bot accounts post 20× more than real people.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 550,
    userGrowthRate: 6,
    audience: 680,
    startingCoins: 0,
    coinRate: 6,
    readKind: 'all',
    readsPerUser: 0.12,
    writesPerUser: 0.01,
    dbReadCost: 0.15,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    unlockedComponentIds: ['api_gateway'],
    unlockedFeatures: ['API gateway', 'Rate limiting'],
    realWorld: [
      'Social networks limit posts per account (Twitter: 2,400 tweets a day) and per IP, and score new accounts for spam.',
      'Rate limiting at the gateway (token bucket per account) answers excess calls with 429 before they touch the database.'
    ],
    story: 'Spam bots discovered your network: about 20 spam posts for every real one. Each is a database write and a row on disk. Put an API gateway at the front door.',
    completionMessage: 'The gateway rejects most spam before it reaches your app or your disk. Next: everyone is scrolling at once.'
  },

  {
    level: 4,
    name: 'Everyone Scrolls',
    subtitle: 'App servers behind a load balancer, a hot feed window',
    intro: 'Users scroll 50× more than they post, and one crash takes the feed down.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1500,
    userGrowthRate: 12,
    audience: 1900,
    startingCoins: 0,
    coinRate: 6,
    readKind: 'all',
    readsPerUser: 0.2,
    writesPerUser: 0.004,
    dbReadCost: 0.05,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    crashes: true,
    keepRecords: 2000,
    unlockedComponentIds: ['load_balancer'],
    unlockedFeatures: ['Load balancer', 'More app servers', 'Hot feed window'],
    realWorld: [
      'App servers are stateless: any of them can build any user\'s feed, so a load balancer can spread scrolls and skip a crashed one.',
      'Feeds only show recent posts: Twitter kept ~800 tweet IDs per timeline. Older posts live in cheaper storage.'
    ],
    story: 'Your network took off: 1,500 people scroll all day, 50 reads for every post. One app server can\'t keep up, and when it crashes the feed is gone. Scale out.',
    completionMessage: 'Stateless app servers share the load, and the hot database only keeps the newest window of posts. Next: building every feed on every scroll is too much work.'
  },

  {
    level: 5,
    name: 'Precomputed Feeds',
    subtitle: 'A feed cache: one list lookup per scroll',
    intro: 'Merging followees\' posts on every scroll swamps the database.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2000,
    userGrowthRate: 15,
    audience: 2500,
    startingCoins: 0,
    coinRate: 6,
    ...FEED_LIST,
    readsPerUser: 0.3,
    writesPerUser: 0.006,
    dbReadCost: 0.15,
    appCallCost: 0.3, // the app also pushes each post into feed lists
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    crashes: true,
    keepRecords: 2000,
    cacheHitRate: 0.92,
    unlockedComponentIds: ['cache'],
    unlockedFeatures: ['Feed cache'],
    realWorld: [
      'Twitter kept every active user\'s home timeline in Redis as a list of tweet IDs; a scroll is one list read.',
      'A viral post is read millions of times: hot posts are cached (and replicated) so one key doesn\'t melt one cache node.'
    ],
    story: 'Building a feed means merging the posts of everyone you follow, on every scroll. The database is drowning. Precompute each user\'s feed as a list of post IDs in a cache.',
    completionMessage: 'Each scroll is now one lookup in the feed cache. The price: every post must be written into its followers\' feeds. Next: that fan-out.'
  },

  {
    level: 6,
    name: 'Background Fan-out',
    subtitle: 'A message queue and fan-out workers',
    intro: 'Each post writes into ~200 followers\' feeds inside the request.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2500,
    userGrowthRate: 6,
    audience: 3100,
    startingCoins: 0,
    coinRate: 6,
    ...FEED_LIST,
    ...FANOUT,
    fanoutPerWrite: 200, // a typical account here has ~200 followers
    readsPerUser: 0.3,
    writesPerUser: 0.006,
    dbReadCost: 0.15,
    appCallCost: 0.3,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    crashes: true,
    keepRecords: 2000,
    cacheHitRate: 0.92,
    unlockedComponentIds: ['message_queue'],
    unlockedFeatures: ['Message queue', 'Fan-out workers'],
    feature: {
      name: 'Fan-out on write',
      summary: 'A new post is copied into every follower\'s feed list. Done inside the request, the poster waits for all of it.',
      endpoints: [
        { method: 'POST', path: '/api/posts', does: 'Publish, then fan out', rate: 'writesPerSec' },
        { method: 'GET', path: '/api/feed', does: 'Read your feed list', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Posting returns at once; a "post created" event goes to Kafka and fan-out workers push the post ID into each follower\'s timeline.',
      'Twitter\'s fan-out did ~300K timeline writes a second for 6K tweets/s: write amplification is the price of fast reads.'
    ],
    story: 'Every post is now copied into each follower\'s feed, about 200 of them, while the poster waits. Posting is slow and the app servers are busy. Move fan-out to the background.',
    completionMessage: 'Posts return straight away; workers fan them out in the background. Next: what happens when someone has millions of followers?'
  },

  {
    level: 7,
    name: 'Celebrity Problem',
    subtitle: 'Hybrid fan-out',
    intro: 'A few huge accounts need ~1,000× the fan-out per post.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3000,
    userGrowthRate: 20,
    audience: 3750,
    startingCoins: 0,
    coinRate: 6,
    ...FEED_LIST,
    ...FANOUT,
    ...CELEBS,
    readsPerUser: 0.3,
    writesPerUser: 0.006,
    dbReadCost: 0.15,
    appCallCost: 0.3,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    crashes: true,
    keepRecords: 2000,
    cacheHitRate: 0.92,
    unlockedComponentIds: [],
    unlockedFeatures: ['Hybrid fan-out'],
    realWorld: [
      'An account with 100M followers would need 100M timeline writes per post. Twitter skips fan-out for such accounts and merges their tweets in at read time.',
      'Instagram and Facebook use the same push/pull mix: push for most users, pull for celebrities and pages.'
    ],
    story: 'Celebrities joined. Each of their posts must reach a thousand times more feeds, the fan-out queue falls behind, and feeds go stale. Change how celebrity posts reach feeds.',
    completionMessage: 'Normal posts are pushed to feeds; celebrity posts are pulled in when a feed is read. The queue keeps up. Next: billions of posts.'
  },

  {
    level: 8,
    shardIdClash: true,
    name: 'Billions of Posts',
    subtitle: 'Database shards and a Snowflake-style ID generator',
    intro: 'One database runs out of disk and writes; per-shard IDs break time ordering.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3500,
    userGrowthRate: 20,
    audience: 4400,
    startingCoins: 0,
    coinRate: 6,
    ...FEED_LIST,
    ...FANOUT,
    ...CELEBS,
    readsPerUser: 0.3,
    writesPerUser: 0.01,
    dbReadCost: 0.15,
    appCallCost: 0.3,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    crashes: true,
    keepRecords: 30000,
    cacheHitRate: 0.92,
    unlockedComponentIds: ['id_generator', 'db_shard'],
    unlockedFeatures: ['Database shards', 'ID generator', 'ID ranges'],
    realWorld: [
      'Twitter built Snowflake: 64-bit IDs from time + machine + sequence, unique without coordination and sortable by time.',
      'Posts are sharded by post ID or author ID; Instagram packs the shard number into each ID.'
    ],
    story: 'Posts arrive faster than one database can write or store them. Split them across shards, and give every post a unique, time-ordered ID.',
    completionMessage: 'Posts are spread over several shards, and one ID generator keeps every ID unique and in time order. Next: the world.'
  },

  {
    level: 9,
    shardIdClash: true,
    name: 'Photos Worldwide',
    subtitle: 'A CDN for photos and far-away users',
    intro: 'Photo-heavy pages and far-away users pay 100+ ms.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 5000,
    userGrowthRate: 25,
    audience: 6200,
    startingCoins: 0,
    coinRate: 4,
    ...FEED_LIST,
    ...FANOUT,
    ...CELEBS,
    readsPerUser: 0.3,
    writesPerUser: 0.006,
    dbReadCost: 0.15,
    appCallCost: 0.3,
    pageViewsPerUser: 0.3,
    pageKB: 200,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    crashes: true,
    keepRecords: 30000,
    cacheHitRate: 0.92,
    globalShare: 0.6,
    distanceMs: 120,
    edgeHitRate: 0.85,
    unlockedComponentIds: ['cdn'],
    unlockedFeatures: ['CDN for photos'],
    realWorld: [
      'Photos and videos are most of a feed\'s bytes. They are served from CDNs (Instagram uses Facebook\'s edge network) in many sizes.',
      'Far-away users pay 100+ ms per round trip; edge servers near them cut that to ~20 ms.'
    ],
    story: 'Your feed is full of photos and 60% of users live on other continents. Every photo crosses an ocean. Serve them from the edge.',
    completionMessage: 'Photos come from a city near each user, and your origin only builds feed lists. That is the shape of Twitter and Instagram.'
  }
];
