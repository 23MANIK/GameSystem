/**
 * URL shortener — words and explanations that differ from the Guestbook's.
 */

export const URL_SHORTENER_VOCAB = {
  record: 'link',
  records: 'links',
  writeFails: 'every new link fails',
  readName: 'redirect'
};

export const URL_SHORTENER_INCIDENTS = {
  spike: [
    { name: 'Shared on a forum', story: 'One of your links is on the front page of a forum.', mult: 1.5 },
    { name: 'Influencer post', story: 'An influencer put your short link in their bio.', mult: 1.8 },
    { name: 'Breaking news', story: 'A news alert with your short link went out to millions of phones.', mult: 2.0, minUsers: 80 }
  ],
  bots: [
    { name: 'Spam attack', story: 'A spam network is creating phishing links through POST /api/shorten.', mult: 3 },
    { name: 'Botnet', story: 'Thousands of hijacked machines are calling POST /api/shorten in a loop.', mult: 4 }
  ],
  crash: [
    { name: 'App server crashed', story: 'One of your app servers ran out of memory and crashed. It is restarting.', crashed: 1 },
    { name: 'Hardware failure', story: 'A disk died in one of your app servers. It is being replaced.', crashed: 1 }
  ]
};

/** Changes to the shared machine and part texts while this product is played. */
export const URL_SHORTENER_ROLE_TEXT = {
  db: { job: 'Stores every link (code → long URL) and finds one by its code.' },
  cache: { job: 'Keeps hot code → URL pairs in memory, so most redirects never reach the database.' },
  cdn: { job: 'Answers popular redirects from servers near each user, and logs the clicks.' },
  gateway: { job: 'Front door for every API call. Rate limiting stops scripts creating thousands of links.' }
};

export const URL_SHORTENER_PART_TEXT = {
  storage: { whatItDoes: 'Where the links are saved so they survive a restart. Its speed decides how many reads and writes per second it can do.' },
  network: { whatItDoes: 'The pipe between your server and the internet. Redirects are tiny (half a KB), so the network is rarely the problem here.' }
};

export const URL_SHORTENER_FIX_TEXT = {
  index: {
    name: 'Primary-key index',
    short: 'Make short_code the table\'s primary key (a B-tree), so the database jumps straight to one code instead of reading every row.',
    effect: 'Database CPU, disk reads and latency stop growing with the number of links. Each new link costs a little more (the index is updated too).'
  }
};

export const URL_SHORTENER_EXPLANATIONS = {
  storage: {
    title: '💾 Storage',
    body: `<p>Where data is saved so it survives a restart. Here: every short link (code, long URL, created time), roughly 100–500 bytes a row.</p>
      <p>Disk <strong>speed</strong> (operations per second) decides how fast rows are found and written. Disk <strong>space</strong> decides how many links fit.</p>
      <p class="info-eg">Real world: 1 billion links ≈ 100–500 GB, which fits on one SSD. 365 billion (ByteByteGo's 10-year estimate) ≈ 36.5 TB does not.</p>`
  },
  feature: {
    title: 'How the shortener uses your server',
    body: `<ul><li><code>POST /api/shorten</code>: save a long URL, return a 7-character code. A write: CPU and a disk write.</li>
      <li><code>GET /{code}</code>: find the code, answer <code>302 Found</code> with <code>Location: https://the-long-url</code>. A read: CPU and a lookup. The response is tiny.</li></ul>
      <p>Reads (clicks) outnumber writes (new links) 10:1 here, and 100:1 or more in real shorteners. So the read path is what you optimise: index, cache, edge.</p>`
  },
  database: {
    title: '🗄️ Database server',
    body: `<p>A machine whose only job is the links: storing them, finding one by its code.</p>
      <p>Table: <code>urls(short_code PRIMARY KEY, long_url, created_at, expires_at)</code>. A relational database (PostgreSQL, MySQL) is a fine choice: writes are few, lookups are by key.</p>
      <p>Splitting it off means the app server stops spending CPU, RAM and disk on data, and each machine can be sized for its own job.</p>`
  },
  diskSpace: {
    title: '💽 Disk space',
    body: `<p>Every link is a row on the database disk. Links are usually kept for years, so the table only grows.</p>
      <p>When the disk is full, <strong>every new link fails</strong>. Fixes: a bigger disk, more shards (Level 7), or expiring old links.</p>
      <p class="info-eg">Sizes are game-scaled (shown as how many links fit) so disks fill in minutes instead of years.</p>`
  },
  index: {
    title: '🔎 Primary-key index',
    body: `<p>Like the index at the back of a book. Without it, to find code <code>aZ3kQ9x</code> the database reads <strong>every row</strong> (a full table scan), and that gets slower with every link.</p>
      <p>With <code>short_code</code> as the primary key (a B-tree), a lookup takes a few steps even among billions of rows: about a millisecond.</p>
      <p class="info-eg">Cost: each new link also updates the index, so writes get a little slower. For a read-heavy shortener that's a great trade.</p>`
  },
  base62: {
    title: '🔤 Base62 short codes',
    body: `<p>Two common ways to make a short code:</p>
      <ul><li><strong>Hash the long URL</strong> (MD5, CRC32) and keep 7 characters. Codes can clash, so you must check "is this code taken?" before saving, and retry on a clash.</li>
      <li><strong>Encode a unique ID in Base62</strong> (0-9, a-z, A-Z): ID 11157 → <code>2TX</code>. Unique by design, so no check is needed.</li></ul>
      <p>7 Base62 characters = 62⁷ ≈ 3.5 trillion codes. The catch: the IDs must be unique across every machine that makes them (see Level 7).</p>`
  },
  cache: {
    title: '⚡ Cache',
    body: `<p>Memory in front of the database (Redis, Memcached) holding hot <code>code → long URL</code> pairs. Redirects check it first; only misses go to the database (<em>cache-aside</em>).</p>
      <p>Link popularity is very skewed: a few links get most of the clicks. So a cache holding a small share of links can answer 90%+ of redirects.</p>
      <p class="info-eg">A link almost never changes once created, so there is little to invalidate. Use LRU eviction and a TTL no longer than the link's expiry.</p>`
  },
  cdn: {
    title: '🌍 CDN / edge redirects',
    body: `<p>Servers in hundreds of cities. With edge code (Cloudflare Workers, Lambda@Edge) they can answer a popular redirect right next to the user, without crossing an ocean.</p>
      <p>Each edge logs the click to your analytics queue, so counts stay right. New links and unpopular codes still go to your servers.</p>`
  },
  redirect301: {
    title: '↪️ 301 vs 302',
    body: `<p><strong>301 Moved Permanently</strong>: the browser remembers it and goes straight to the long URL next time. Less load, but you never see repeat clicks.</p>
      <p><strong>302 Found</strong> (temporary): every click comes back to you. More load, but every click is counted, and you can change or expire the link later.</p>
      <p>Shorteners that sell analytics (like bit.ly) use 302, or 301 with a short <code>Cache-Control</code>.</p>`
  },
  expiry: {
    title: '⏳ Link expiry',
    body: `<p>Store an <code>expires_at</code> on each link. Expired codes answer <code>410 Gone</code>, and a nightly job deletes them (or a lazy check on read).</p>
      <p>The tables stop growing forever, so you need fewer shards and disks.</p>`
  },
  clickAnalytics: {
    title: '📊 Click analytics',
    body: `<p>For every click: which code, when, from which country, referrer and device. Customers pay to see these counts.</p>
      <p>Writing a counter <em>inline</em> makes each redirect wait for a database write. Instead, send an event to a <strong>queue</strong> and let a worker count in batches.</p>
      <p class="info-eg">Real world: Kafka → Flink/Spark → ClickHouse or Druid. The analytics pipeline often ends up bigger than the shortener itself.</p>`
  }
};
