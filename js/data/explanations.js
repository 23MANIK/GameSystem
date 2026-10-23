/**
 * explanations.js — the text behind every (i) button.
 * Keep each one short and plain: what it is, why it matters, what to do.
 */

export const EXPLANATIONS = {
  // ─── Server parts ───
  cpu: {
    title: '🧠 CPU',
    body: `<p>The CPU does the work for every request: running your code and building each response.</p>
      <p><strong>More cores = more requests per second.</strong> When it's full, requests wait in line, pages get slow and some time out.</p>
      <p class="info-eg">Real world: a small cloud server has 1–2 vCPUs; big ones have 64+.</p>`
  },
  ram: {
    title: '🧩 Memory (RAM)',
    body: `<p>Fast short-term memory. The operating system and app need ~400 MB just to run, and every online user needs a little more for their session.</p>
      <p><strong>Running out of RAM is the worst failure:</strong> the server starts swapping to disk or the app crashes. That's why errors climb fastest when RAM is over 100%.</p>`
  },
  storage: {
    title: '💾 Storage',
    body: `<p>Where data is saved so it survives a restart. Here: every Guestbook entry.</p>
      <p>What limits you is <strong>speed</strong> (reads/writes per second), not size. A spinning HDD is ~100× slower than an SSD.</p>
      <p class="info-eg">Most reads come from the OS cache in memory, so only some of them hit the disk. Every write does.</p>`
  },
  network: {
    title: '🌐 Network',
    body: `<p>The pipe between your server and the internet. Every response travels through it.</p>
      <p><strong>Watch out:</strong> "Read all" sends back <em>every</em> entry, so each response grows as the Guestbook grows. Network fills up slowly over time even with the same number of users.</p>
      <p class="info-eg">Later levels fix this with pagination and caching.</p>`
  },

  // ─── HUD ───
  resources: {
    title: 'How busy your server is',
    body: `<p>Each bar shows how much of a part is used right now.</p>
      <ul><li><strong>Under 70%:</strong> healthy.</li>
      <li><strong>70–100%:</strong> latency goes up (amber over 80%).</li>
      <li><strong>Over 100%:</strong> overloaded. Requests fail, you lose money, users leave (red).</li></ul>
      <p>The part that fills up first is your <strong>bottleneck</strong>. Upgrading anything else doesn't help.</p>`
  },
  userLimit: {
    title: '👥 Users / limit',
    body: `<p>Left: people online right now. Right: the most your server can handle before a part goes over 100%.</p>
      <p>New users keep arriving even past the limit (they don't know it). Then the server overloads and some leave. To grow, raise the limit by upgrading the bottleneck part.</p>`
  },
  reputation: {
    title: '⭐ Reputation',
    body: `<p>What people think of your product, from 0 to 100.</p>
      <ul><li><strong>Drops fast</strong> while requests are failing.</li>
      <li><strong>Recovers slowly</strong> (+0.5 every 2 seconds) while things are healthy.</li></ul>
      <p>Low reputation means <strong>slower user growth</strong> (down to 25%) and a <strong>smaller funding round</strong> (down to half).</p>`
  },
  latency: {
    title: '📶 Latency',
    body: `<p>How long a request takes, in milliseconds. ~20 ms is snappy.</p>
      <p>It climbs once any part is over ~70% busy, because requests start waiting in line. Keep headroom to keep it low.</p>`
  },
  spike: {
    title: '📈 Traffic spikes',
    body: `<p>Every couple of minutes something sends a wave of traffic: a forum post, an influencer, the front page. For 20 seconds every user sends more requests: +20–40% in Level 1, up to 2× later.</p>
      <ul><li><strong>Handled</strong> (under 5% failing): you earn extra from the extra traffic.</li>
      <li><strong>Not handled:</strong> lost revenue, refunds, users leave, reputation drops.</li></ul>
      <p>To survive one you need <strong>headroom</strong>: spare capacity above your normal load. In Level 1 your audience stops at ~130 users, so a server that "can handle" ~180 rides out any spike.</p>`
  },

  // ─── Builder ───
  bottleneck: {
    title: 'Runs out first (bottleneck)',
    body: `<p>Every part can handle a different number of users. The server can only handle as many as its <strong>weakest</strong> part.</p>
      <p>Upgrade that part first. The next weakest becomes the new bottleneck, and so on.</p>`
  },
  runningCost: {
    title: 'Running cost',
    body: `<p>Like a cloud bill: the server costs coins every minute it's on, about 12% of its price per minute.</p>
      <p>Bigger parts raise your limit <em>and</em> your bill. Buy what you need, a little before you need it.</p>`
  },
  verticalScaling: {
    title: 'Vertical scaling',
    body: `<p>Making one machine bigger: more CPU, more RAM, faster disk, fatter network pipe.</p>
      <p><strong>Good:</strong> simple, nothing in your app changes.<br><strong>Bad:</strong> there's a biggest machine you can buy, and if it dies, everything dies.</p>
      <p>Later levels teach <em>horizontal</em> scaling: more machines instead of bigger ones.</p>`
  },

  // ─── Feature ───
  feature: {
    title: 'How the Guestbook uses your server',
    body: `<p>Your app has two endpoints. Every online user calls them on their own:</p>
      <ul><li><code>GET /entries</code>: read <em>every</em> entry. ~0.2 per user per second. Uses CPU, RAM, a little disk, and lots of network (the response grows with the book).</li>
      <li><code>POST /entries</code>: sign with a name. ~1 per user every 4 minutes. Uses CPU and a disk write.</li></ul>
      <p>So this app is <strong>read-heavy</strong>: about 50 reads for every write. That's typical, and it's why caching matters so much in later levels.</p>`
  },

  // ─── Money ───
  revenue: {
    title: 'Revenue',
    body: `<p>Coins your users bring in (think ads or subscriptions). More users online = more revenue.</p>
      <p>Only <strong>successful</strong> requests earn. Failed ones earn nothing and are counted as lost revenue.</p>`
  },
  lostRevenue: {
    title: 'Lost to failed requests',
    body: `<p>What you <em>would</em> have earned if the server hadn't failed those requests.</p>
      <p>It grows whenever a part is over 100%, especially during spikes. Fixing the bottleneck fast keeps this low.</p>`
  },
  penalties: {
    title: 'Outage penalties',
    body: `<p>When 5% or more of requests fail, it's a real outage: refunds, support tickets, angry customers. You pay coins for every tick it lasts.</p>`
  },
  profit: {
    title: 'Profit',
    body: `<p><strong>Profit = revenue − running cost − outage penalties.</strong></p>
      <p>Funding uses <strong>profit per minute</strong>, not the total, so finishing faster with a healthy server is worth more than dragging the level out.</p>`
  },
  dailyUsers: {
    title: 'Estimated daily users',
    body: `<p>People don't stay online all day. Each person online at a given moment stands for about 10 different people who visit at some point in the day.</p>
      <p>So: average users online × 10. Investors care about this number.</p>`
  },
  uptime: {
    title: 'Uptime',
    body: `<p>The share of time your server answered (almost) every request: under 5% failing.</p>
      <p class="info-eg">Real services aim for 99.9% ("three nines") or better.</p>`
  },
  funding: {
    title: '💸 Funding rounds',
    body: `<p>When you finish a level, investors put in roughly what the next stage costs (angel 1,500 → Series E 12,000), then adjust it:</p>
      <ul><li><strong>Users</strong>: your average users vs the level's target (×0.5 to ×1.2)</li>
      <li><strong>Profit</strong>: how much of your revenue you kept (×0.7 to ×1.3). Oversized machines eat into this.</li>
      <li><strong>Reliability</strong>: outages can cut it down to half</li></ul>
      <p>Funding alone won't pay for everything: your own profit has to cover the rest, so spend where it matters.</p>`
  },

  // ─── Level 2: app + database ───
  database: {
    title: '🗄️ Database server',
    body: `<p>A machine whose only job is the data: storing entries, finding them, sending them back.</p>
      <p>Your first server becomes the <strong>app server</strong>: it builds pages and keeps user sessions, then asks the database for data over the internal network.</p>
      <ul><li><strong>Why split?</strong> Each machine can be sized for its own job, and the data no longer fights the app for CPU, RAM and disk.</li>
      <li><strong>Cost:</strong> two running bills, and a tiny extra hop (~2 ms) per request.</li></ul>
      <p class="info-eg">This is the classic first step in "scaling from zero to millions".</p>`
  },
  appServer: {
    title: '🖥️ App server',
    body: `<p>Runs your code: receives each request, builds the page, keeps user sessions in RAM, and sends the response to the user.</p>
      <p>Once there's a database server, the app server barely touches its disk. Its CPU, RAM and network matter most.</p>`
  },
  diskSpace: {
    title: '💽 Disk space',
    body: `<p>Disks have <strong>speed</strong> (reads/writes per second) and <strong>size</strong> (how much fits). Both can run out.</p>
      <ul><li><strong>HDD:</strong> huge but slow.</li><li><strong>SSD:</strong> fast but small.</li><li><strong>NVMe:</strong> fastest, mid-size, priciest.</li></ul>
      <p>When the disk is full, <strong>every write fails</strong>: nobody can sign the Guestbook.</p>
      <p class="info-eg">Sizes are game-scaled (shown as how many entries fit) so disks fill in minutes instead of months.</p>`
  },
  pagination: {
    title: '📄 Pagination',
    body: `<p>Instead of sending <em>every</em> entry on each read, send one page (50 entries) and let the user ask for the next page.</p>
      <p>Without it, each response grows with the Guestbook: 2,000 entries means ~2 MB per read, which floods the network on both machines.</p>
      <p class="info-eg">Almost every real list on the web is paginated or uses infinite scroll for this reason.</p>`
  },
  index: {
    title: '🔎 Database index',
    body: `<p>Like the index at the back of a book. Without it, to find the newest entries the database reads <strong>every row</strong> (a full table scan), and that gets slower as the table grows.</p>
      <p>With an index it jumps straight to the right rows: database CPU, disk reads and query time stay flat as data grows.</p>
      <ul><li><strong>Trade-off:</strong> each write must also update the index, so writes get a bit more expensive.</li></ul>`
  },
  archive: {
    title: '🗃️ Archiving old data',
    body: `<p>Most people only look at recent entries. Archiving keeps the newest 2,000 in the fast database and moves older ones to cheap, slow "cold" storage.</p>
      <p>The hot database stops growing: disk space, scans and response sizes stay flat no matter how big the Guestbook gets.</p>
      <p class="info-eg">Real systems do this with old orders, logs and messages all the time.</p>`
  },

  // ─── Levels 3–7: more kinds of machine ───
  webServer: {
    title: '🌐 Web (UI) server',
    body: `<p>Serves the user interface: HTML, CSS, JavaScript and images. These are <strong>static files</strong>: the same for everyone, cheap to send but big.</p>
      <p>Splitting them off means the app server only answers small JSON API calls, and each machine can be sized for its job: the web server needs <strong>network</strong>, the app server needs <strong>CPU</strong>.</p>`
  },
  gateway: {
    title: '🚦 API gateway',
    body: `<p>The single front door for every API request. Because everything passes through it, it can check who is calling, how often, and block abuse before it reaches your app.</p>
      <ul><li><strong>Costs:</strong> it looks at every request (bots too), so it needs some CPU, and adds ~2 ms.</li></ul>`
  },
  rateLimiting: {
    title: '🛑 Rate limiting',
    body: `<p>Each client gets a budget, e.g. 60 requests a minute. Go over it and you get <strong>429 Too Many Requests</strong> instead of an answer.</p>
      <p>Real users never hit the limit. Bots and scrapers, which call non-stop, get blocked: here ~95% of bot traffic never reaches your servers.</p>`
  },
  loadBalancer: {
    title: '⚖️ Load balancer',
    body: `<p>Receives every API request and passes it to one of your app servers, spreading the work evenly.</p>
      <ul><li>Checks which servers are healthy and <strong>skips any that are down</strong>.</li>
      <li>The work is light: a small one can feed many app servers.</li></ul>`
  },
  horizontalScaling: {
    title: 'Horizontal scaling',
    body: `<p>Instead of one bigger machine (vertical), use <strong>more machines</strong> sharing the work.</p>
      <ul><li><strong>No ceiling:</strong> need more? Add another.</li>
      <li><strong>Survives failures:</strong> with 3 servers, one can crash and the other 2 carry on. With 1, a crash is an outage.</li></ul>
      <p>The app servers must be <em>stateless</em> (any server can answer any user), which is why sessions and data live elsewhere.</p>`
  },
  cache: {
    title: '⚡ Cache',
    body: `<p>Fast memory (like Redis) holding answers that were asked for recently. A read checks the cache first:</p>
      <ul><li><strong>Hit:</strong> answered from memory in ~1 ms, the database never sees it.</li>
      <li><strong>Miss:</strong> goes to the database, and the answer is saved in the cache for next time.</li></ul>
      <p>The <strong>hit rate</strong> is what matters. Caches work best when many people ask for the same thing, like the first page of the Guestbook.</p>`
  },
  cdn: {
    title: '🌍 CDN (content delivery network)',
    body: `<p>Servers in cities all over the world keep copies of your pages and popular answers. Each user is served by the nearest one.</p>
      <ul><li>A request from far away no longer crosses an ocean: ~120 ms saved.</li>
      <li>Most traffic is answered at the edge, so your own servers see much less.</li></ul>
      <p class="info-eg">Pages and paginated reads cache well. Writes still have to travel to your servers.</p>`
  },

  codeFixes: {
    title: '🧑‍💻 Code fixes',
    body: `<p>One-time purchases that make every request cheaper. No new machines, no running cost.</p>
      <p>When the data grows, bigger hardware only buys time: a full table scan on the fastest CPU is still a full table scan. Fixing the code changes the shape of the problem.</p>`
  },

  // ─── Challenges ───
  challenges: {
    title: '🎯 Challenges',
    body: `<p>Finish <strong>every</strong> challenge to complete the level. Once a challenge is done it stays done, even if the number dips later.</p>
      <p>Each one has a hint. Stuck? Open <strong>Server</strong> and look at what "runs out first".</p>`
  },

  // ─── Machines used by some products ───
  idGenerator: {
    title: '🔢 ID generator',
    body: `<p>One place that hands out unique numbers, so two servers or two database shards never create the same ID.</p>
      <p>Common choices: a Redis counter (<code>INCR</code>), a "ticket server" (a tiny database with one auto-increment column), or Snowflake-style IDs built from time + machine number + a sequence.</p>
      <p class="info-eg">It must not become a single point of failure: run it with a replica, and let servers take IDs in blocks so a short outage doesn't stop writes.</p>`
  },
  stateless: {
    title: '🔁 Stateless servers',
    body: `<p>A server is <strong>stateless</strong> when it keeps nothing about a user between requests: no sessions in memory, no files on its own disk. Everything lasting lives in the database or cache.</p>
      <p>Then any server can answer any request, so a load balancer can send traffic anywhere, and you can add, remove or replace servers freely. A crash loses nothing.</p>`
  },
  blobStorage: {
    title: '🪣 Blob (object) storage',
    body: `<p>A service built to store huge numbers of large files ("blobs"): S3, Google Cloud Storage, Azure Blob. You put and get whole objects by key; it handles copies, durability (11 nines) and near-unlimited space.</p>
      <p>Much cheaper per GB than server disks or databases. Keep the <strong>bytes</strong> here, and only the <strong>metadata</strong> (name, size, owner, where the bytes are) in your database.</p>`
  },
  syncServer: {
    title: '🔄 Sync server (push)',
    body: `<p>Without it, every device asks "anything new?" every few seconds (polling): lots of requests, most finding nothing, and changes still arrive late.</p>
      <p>A sync server keeps one live <strong>WebSocket</strong> per device and pushes a notice the moment a file changes. Each open connection costs RAM, even when idle, so RAM grows with devices online. Keep a slow poll as a safety net in case a notice is missed.</p>`
  },
  presigned: {
    title: '🔏 Pre-signed URLs',
    body: `<p>Your server signs a link that allows one upload (or download) of one object for a few minutes. The client then talks to blob storage directly.</p>
      <p>Your app servers stop carrying file bytes: they only check permissions and sign links. Gateways often cap request bodies (~10 MB), so big files must go direct anyway.</p>`
  },
  chunking: {
    title: '🧩 Chunked uploads',
    body: `<p>A 50 GB file over a 100 Mbps link takes over an hour as one request: it would time out, hit size limits, and restart from zero if the Wi-Fi blinks.</p>
      <p>Split the file <strong>on the client</strong> into 5–10 MB chunks, upload them in parallel, and record each chunk's status. A dropped upload resumes from the last chunk. S3 calls this <em>multipart upload</em>.</p>`
  },
  dedup: {
    title: '🧬 Fingerprints and dedup',
    body: `<p>Hash each chunk (SHA-256): the hash is its fingerprint. Same bytes, same fingerprint, whatever the file's name or owner.</p>
      <p>Before uploading, the client asks "do you already have these fingerprints?". Chunks already stored are skipped. Popular files, re-uploads and copies cost almost nothing.</p>`
  },
  verifyUploads: {
    title: '🔍 Verify uploads on the server',
    body: `<p>With chunked uploads, someone must record which chunks are done. Trusting the client's "chunk N uploaded" message is simple, but clients crash, retry and double-report: some files end up marked complete with a chunk missing.</p>
      <p>Instead, check with the storage itself (S3 <em>ListParts</em>, or its "object created" events) and only then mark the chunk, and finally the file, as uploaded.</p>`
  },
  compress: {
    title: '🗜️ Compression',
    body: `<p>Compressing on the client means fewer bytes to send and store. It's worth it for text (a 5 GB log can shrink to 1 GB) but not for photos or videos, which are already compressed.</p>
      <p>Compression takes client time, so decide per file type. Always compress <strong>before</strong> encrypting: encrypted data looks random and won't shrink.</p>`
  },
  sharesTable: {
    title: '🤝 Shares table',
    body: `<p>A share list inside each file's metadata makes "what's shared with <em>me</em>?" scan every file. A separate table keyed by the user who received the share answers it in one lookup.</p>
      <p>It's a little more to write when you share, but reads are what users do all day.</p>`
  },
  deltaSync: {
    title: '✂️ Delta sync',
    body: `<p>When you edit one line of a big file, re-uploading the whole file is wasteful. Send only the chunks whose fingerprints changed.</p>
      <p>Fixed-size chunks break this: insert one byte at the start and every later chunk shifts. <strong>Content-defined chunking</strong> (a rolling hash such as Rabin) picks boundaries from the content, so an edit only changes nearby chunks.</p>`
  },
  versions: {
    title: '🗂️ Versions and conflicts',
    body: `<p>Two people edit the same file offline and both save. With <strong>last write wins</strong>, one edit silently disappears.</p>
      <p>Keep versions instead, and on a clash save the second as a "conflicted copy" (what Dropbox does). Docs-style apps merge edits (OT / CRDTs), but for arbitrary files keeping both is the safe choice. It costs storage.</p>`
  },
  coldTier: {
    title: '🧊 Cold storage',
    body: `<p>Most files are rarely opened after the first weeks. Cold storage classes (S3 Glacier, GCS Coldline) cost a fraction per GB, but reading is slower or costs extra.</p>
      <p>Pair it with <strong>erasure coding</strong>: instead of 3 full copies, split data into pieces plus parity (like RAID), so you survive lost disks with ~1.5× the space instead of 3×.</p>`
  },
  idRanges: {
    title: '📦 ID ranges (batching)',
    body: `<p>Instead of one call per new ID, each app server asks for a block (say IDs 5,001–6,000) and uses them from memory.</p>
      <p>The ID generator gets ~1,000× fewer calls. If a server dies, the rest of its block is skipped. That's fine: IDs only need to be unique, not gap-free.</p>`
  },
  messageQueue: {
    title: '📨 Message queue',
    body: `<p>A durable buffer between the part that <em>produces</em> work and the part that <em>does</em> it (Kafka, RabbitMQ, SQS, Pub/Sub).</p>
      <p>The producer drops an event in and moves on, so users never wait. A worker reads events at its own pace, in batches, and retries failures.</p>
      <p class="info-eg">Use it for anything that doesn't have to happen before you answer the user: analytics, emails, notifications, video processing.</p>`
  },
  sharding: {
    title: '🧱 Sharding',
    body: `<p>Splitting one big table across several database machines. Each <strong>shard</strong> holds a slice of the rows, chosen by a <em>shard key</em> (e.g. a hash of the short code).</p>
      <p>You get more disks, more CPU and more write capacity: each shard sees only its share. The cost: anything that must stay unique or be joined across shards (like IDs) needs extra care.</p>
      <p class="info-eg">Consistent hashing lets you add shards later while moving only a small share of rows.</p>`
  },
  realWorld: {
    title: '🌍 Real world',
    body: `<p>The game's numbers are scaled down so things happen in minutes. These notes give the real numbers and services, so you can map your design onto a real cloud.</p>
      <p>Order of magnitude matters more than exact values: 1 vs 1,000 requests a second, gigabytes vs terabytes.</p>`
  },
  blueprint: {
    title: '📐 Blueprint',
    body: `<p>Your current architecture, written out: every machine, its parts, and the matching managed services on AWS and Google Cloud.</p>
      <p><strong>Copy</strong> it as JSON to keep it, or to use it as the starting point for real infrastructure (Terraform, CloudFormation).</p>
      <p class="info-eg">Game parts map to real sizes by order of magnitude: 4 vCPU / 4 GB here is roughly an AWS c6g.xlarge.</p>`
  }
};

// The Guestbook's text, kept so a product can override some entries and switch back
const BASE_EXPLANATIONS = { ...EXPLANATIONS };

/** Use a product's explanations on top of the shared ones (see js/products/registry.js). */
export function setExplanationOverrides(overrides = {}) {
  for (const key of Object.keys(EXPLANATIONS)) {
    if (!(key in BASE_EXPLANATIONS)) delete EXPLANATIONS[key];
  }
  Object.assign(EXPLANATIONS, BASE_EXPLANATIONS, overrides);
}
