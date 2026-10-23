/**
 * URL shortener (like bit.ly / TinyURL) — the levels.
 *
 * Sources: ByteByteGo "Design a URL Shortener", Hello Interview "Design Bitly",
 * and common interview write-ups (see docs/products/url-shortener.md).
 *
 *   1. First Short Link    — one server: shorten + redirect
 *   2. Links Pile Up       — own database, primary-key index, Base62 codes
 *   3. Spam Wave           — API gateway rate-limits link creation
 *   4. Scale Out           — stateless app servers behind a load balancer
 *   5. Viral Links         — cache hot links (reads are 100× writes)
 *   6. Click Analytics     — count every click through a message queue
 *   7. Billions of Links   — shard the database, global ID generator
 *   8. Go Global           — redirect at the edge (CDN), 301 vs 302
 *
 * Traffic is "per online user per second". Game users stand in for real traffic
 * by order of magnitude: each level's `realWorld` note gives the real numbers.
 */

// A redirect is one key lookup and a tiny response: cheaper than a JSON API call
const LOOKUP = { readKind: 'lookup', appCallCost: 0.25 };

export const URL_SHORTENER_LEVELS = [
  {
    level: 1,
    name: 'First Short Link',
    subtitle: 'One server shortens and redirects',
    intro: 'Every link shortener starts as one machine that stores links and redirects.',
    mode: 'single-server',
    serverMode: true,
    userTarget: 100,
    userGrowthRate: 2,
    audience: 130,
    spikeRange: [1.2, 1.4],
    startingCoins: 500,
    coinRate: 25,
    ...LOOKUP,
    readsPerUser: 0.2,
    writesPerUser: 0.01,
    unlockedComponentIds: ['monolith'],
    unlockedFeatures: ['Shorten a link', 'Redirect'],
    feature: {
      name: 'Shorten and redirect',
      summary: 'Paste a long URL, get a 7-character code like sho.rt/aZ3kQ9x. Anyone who opens the short link is sent on to the long one.',
      endpoints: [
        { method: 'POST', path: '/api/shorten', does: 'Long URL → new short code', rate: 'writesPerSec' },
        { method: 'GET', path: '/{code}', does: '302 redirect to the long URL', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Reads (redirects) far outnumber writes (new links): about 10:1 here, 100:1 or more at bit.ly scale.',
      'A $20/month VM (2 vCPU, 4 GB) running the app and PostgreSQL together redirects ~1,000 requests/s: a side project with ~100k clicks a day.'
    ],
    story: 'Every link shortener starts as one machine. It stores each long URL with a short code and answers redirects. Build it, open it to the public and grow to 100 users.',
    completionMessage: 'One server shortens and redirects for 100 users. Redirects are tiny (a 302 with a Location header), so the machine mostly needs CPU. Next: the links table keeps growing.'
  },

  {
    level: 2,
    name: 'Links Pile Up',
    subtitle: 'Own database, an index, Base62 codes',
    intro: 'Links pile up by the thousand, and every redirect searches the whole table.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 400,
    userGrowthRate: 4,
    audience: 500, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 6,
    ...LOOKUP,
    readsPerUser: 0.2,
    // Marketing teams import links in bulk through the API
    writesPerUser: 0.025,
    dbReadCost: 0.1,
    unlockedComponentIds: ['database'],
    unlockedFeatures: ['Database server', 'Primary-key index', 'Base62 codes'],
    feature: {
      name: 'Bulk link creation',
      summary: 'Marketing teams create links in bulk. Every new link is a row (code, long URL, created_at), and every redirect must find one row among thousands.',
      endpoints: [
        { method: 'POST', path: '/api/shorten', does: 'Create a short link', rate: 'writesPerSec' },
        { method: 'GET', path: '/{code}', does: 'Find the row, redirect', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'ByteByteGo\'s estimate: 100M new links a day ≈ 1,160 writes/s. Over 10 years that is 365 billion rows × ~100 bytes ≈ 36.5 TB.',
      'With short_code as the PRIMARY KEY (a B-tree index), finding one row among billions takes a few disk reads instead of a full scan.'
    ],
    story: 'Marketing teams discovered you and create links by the thousand. Your one server stores every row AND answers redirects, and each redirect searches the whole table. Give the data its own machine.',
    completionMessage: 'The links live in their own database, found by primary key in about a millisecond. Codes now come from unique IDs in Base62 instead of hash-and-check. Next: not everyone creating links is human.'
  },

  {
    level: 3,
    name: 'Spam Wave',
    subtitle: 'Rate-limit link creation at an API gateway',
    intro: 'Spam scripts create 30 junk links for every real one.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 600,
    userGrowthRate: 5,
    audience: 700, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 6,
    ...LOOKUP,
    readsPerUser: 0.18,
    writesPerUser: 0.005,
    dbReadCost: 0.1,
    // Spammers script POST /api/shorten to hide phishing links
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.15,
    unlockedComponentIds: ['rate_limiter'],
    unlockedFeatures: ['API gateway', 'Rate limiting'],
    feature: {
      name: 'Shortener under spam',
      summary: 'Spammers found your free API. Scripts create thousands of links to hide phishing pages. Every spam link is a database write and a row on your disk, and it earns nothing.',
      endpoints: [
        { method: 'POST', path: '/api/shorten', does: 'Real users create links', rate: 'writesPerSec' },
        { method: 'BOT', path: '/api/shorten', does: 'Spam scripts', rate: 'botsPerSec' },
        { method: 'GET', path: '/{code}', does: 'Redirect', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Bitly and TinyURL limit link creation per API key and IP (a token bucket, e.g. 100 links/hour on free plans) and answer "429 Too Many Requests" beyond it.',
      'They also check new long URLs against phishing and malware lists (like Google Safe Browsing) before creating them.'
    ],
    story: 'Spam scripts are hammering POST /api/shorten: about 30 spam links for every real one. Your database is busy writing junk and your disk fills with it. Put a gateway at the front door.',
    completionMessage: 'Every API call now passes a gateway that counts requests per client. Scripts get "429 Too Many Requests" before they reach your app, and your disk only holds real links.'
  },

  {
    level: 4,
    name: 'Scale Out',
    subtitle: 'Stateless app servers behind a load balancer',
    intro: 'A news site sends you 1,500 users, and one crash breaks every link.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1500,
    userGrowthRate: 12,
    audience: 1900, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 5,
    ...LOOKUP,
    readsPerUser: 0.2,
    writesPerUser: 0.005,
    dbReadCost: 0.1,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.1,
    crashes: true,
    keepRecords: 12000, // links kept once expiry is on (write rate × how long links live)
    unlockedComponentIds: ['load_balancer'],
    unlockedFeatures: ['Load balancer', 'Multiple app servers', 'Link expiry'],
    story: 'A news site now shortens every article link with you: 1,500 users. No single app server is that big, and when your only one crashes, every link on the internet that points at you breaks.',
    realWorld: [
      'A redirect needs no session or user state, so app servers are stateless: any server can answer any request, and you add or remove them freely.',
      'Behind an AWS Application Load Balancer, an Auto Scaling group adds servers when average CPU passes ~60% and replaces ones that fail health checks.'
    ],
    completionMessage: 'Several stateless app servers share the work and the load balancer skips any that crash. Need more capacity? Add a server.'
  },

  {
    level: 5,
    name: 'Viral Links',
    subtitle: 'Cache the hot links',
    intro: 'A link went viral: the same few codes are clicked over and over.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2500,
    userGrowthRate: 15,
    audience: 3100, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 5,
    ...LOOKUP,
    // A few links go viral: clicks jump 50%, and most of them hit the same codes
    readsPerUser: 0.3,
    writesPerUser: 0.005,
    dbReadCost: 0.1,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.1,
    crashes: true,
    keepRecords: 12000, // links kept once expiry is on (write rate × how long links live)
    cacheHitRate: 0.93,
    unlockedComponentIds: ['redis_cache'],
    unlockedFeatures: ['Cache'],
    story: 'A celebrity posted one of your links. Clicks jump by half and now outnumber new links 60 to 1, and most of them ask for the same few codes. Every one still goes to your single database.',
    realWorld: [
      'Link popularity is very skewed: a tiny share of links gets most clicks. A Redis cache with a few GB of hot links answers 90%+ of redirects from memory (well under 1 ms).',
      'Mappings almost never change, so cache-aside with an LRU eviction and a long TTL works with little invalidation.'
    ],
    completionMessage: 'Hot links are answered from memory. The database now only sees cache misses and new links, so it stays calm even when a link goes viral.'
  },

  {
    level: 6,
    name: 'Click Analytics',
    subtitle: 'Count every click through a message queue',
    intro: 'Customers want click counts, and every click now writes to your database.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3000,
    userGrowthRate: 15,
    audience: 3700, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 6,
    ...LOOKUP,
    readsPerUser: 0.3,
    writesPerUser: 0.005,
    dbReadCost: 0.1,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.1,
    crashes: true,
    keepRecords: 12000, // links kept once expiry is on (write rate × how long links live)
    cacheHitRate: 0.93,
    clickTracking: true,
    unlockedComponentIds: ['message_queue'],
    unlockedFeatures: ['Click analytics', 'Message queue'],
    feature: {
      name: 'Click analytics',
      summary: 'Customers pay to see how many people clicked their links. Right now every redirect also runs UPDATE clicks = clicks + 1 on the database before answering.',
      endpoints: [
        { method: 'GET', path: '/{code}', does: 'Redirect (and count the click)', rate: 'readsPerSec' },
        { method: 'EVT', path: 'click event', does: 'Record time, country, referrer', rate: 'clicksPerSec' },
        { method: 'POST', path: '/api/shorten', does: 'Create a short link', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'Each redirect publishes a small click event (code, time, country, referrer, device) to Kafka and returns at once. Stream processors (Flink, Spark) aggregate them into an analytics store like ClickHouse.',
      'Bitly reports billions of clicks a month: far more click events than links. The analytics pipeline is bigger than the shortener itself.'
    ],
    story: 'Analytics launched: every click must be counted. The cache answers redirects, but each one now also writes to the database, so your quiet database is suddenly drowning in writes.',
    completionMessage: 'Redirects drop a click event in the queue and answer straight away. A worker folds 50 events into one database write. Clicks are counted without slowing anyone down.'
  },

  {
    level: 7,
    name: 'Billions of Links',
    subtitle: 'Shard the database, one global ID generator',
    intro: 'Links pour in by the million: one database can’t hold them, and shards clash.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3500,
    userGrowthRate: 20,
    audience: 4400, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 7,
    ...LOOKUP,
    readsPerUser: 0.3,
    // Partners (social networks, email tools) create links through the API
    writesPerUser: 0.03,
    dbReadCost: 0.1,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.1,
    crashes: true,
    cacheHitRate: 0.93,
    clickTracking: true,
    keepRecords: 30000, // links kept once expiry is on (write rate × how long links live)
    unlockedComponentIds: ['id_generator', 'db_shard'],
    unlockedFeatures: ['Database shards', 'ID generator', 'ID ranges'],
    feature: {
      name: 'Partner API',
      summary: 'Social networks and email tools now shorten every link they send. New links pour in faster than one database disk can hold.',
      endpoints: [
        { method: 'POST', path: '/api/shorten', does: 'Partners create links', rate: 'writesPerSec' },
        { method: 'GET', path: '/{code}', does: 'Redirect', rate: 'readsPerSec' },
        { method: 'EVT', path: 'click event', does: 'Count the click', rate: 'clicksPerSec' }
      ]
    },
    realWorld: [
      'Hello Interview sizes 1B links at ~500 GB: one big machine could hold it, but write volume and growth push you to shard by short code (hash(code) mod N, or consistent hashing).',
      'Unique IDs come from a central counter (Redis INCR or a ticket server, each app server taking 1,000 at a time) or from Twitter Snowflake-style IDs built from time + machine + sequence.'
    ],
    story: 'Partners create links by the million. Your database disk is nearly full and no single machine is big enough. Split the links across several databases (shards), and make sure codes stay unique across all of them.',
    completionMessage: 'Links are spread over several shards, each holding a slice. A single ID generator guarantees that no two links ever get the same code, and expiry keeps the tables from growing forever.'
  },

  {
    level: 8,
    name: 'Go Global',
    subtitle: 'Redirect at the edge, 301 vs 302',
    intro: '60% of clicks come from far away and wait 120 ms before reaching you.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 5000,
    userGrowthRate: 25,
    audience: 6200, // growth stops here, so you can build headroom
    startingCoins: 0,
    coinRate: 4,
    ...LOOKUP,
    readsPerUser: 0.3,
    writesPerUser: 0.01,
    dbReadCost: 0.1,
    botKind: 'write',
    botShare: 1,
    spamPerUser: 0.1,
    crashes: true,
    cacheHitRate: 0.93,
    clickTracking: true,
    keepRecords: 30000, // links kept once expiry is on (write rate × how long links live)
    globalShare: 0.6,
    distanceMs: 120,
    edgeHitRate: 0.8,
    unlockedComponentIds: ['cdn'],
    unlockedFeatures: ['CDN edge redirects', '301 or 302'],
    story: 'Your links are clicked worldwide: 60% of clicks come from other continents and wait ~120 ms just to reach your servers. A redirect should feel instant.',
    realWorld: [
      'Edge platforms (Cloudflare Workers, Lambda@Edge) answer popular redirects from 300+ cities in under 20 ms and stream each click to the analytics pipeline.',
      'A 301 is cached by browsers, so repeat clicks never reach you: cheaper, but invisible to analytics. Most shorteners use 302 (or 301 with a short Cache-Control) to keep counting.'
    ],
    completionMessage: 'Redirects are answered close to every user, clicks are still counted, and your origin only sees misses and new links. That is the architecture behind bit.ly and TinyURL.'
  }
];
