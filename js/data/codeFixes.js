/**
 * codeFixes.js — one-time code improvements you can buy.
 * They don't add machines; they make each request cheaper.
 */

export const CODE_FIXES = {
  pagination: {
    id: 'pagination',
    name: 'Pagination',
    icon: '📄',
    cost: 400,
    unlockLevel: 2,
    short: '"Read all" returns 50 entries per page instead of every entry.',
    effect: 'Responses stop growing with the Guestbook: much less network on every machine. Pages also cache much better.',
    info: 'pagination'
  },
  index: {
    id: 'index',
    name: 'Database index',
    icon: '🔎',
    cost: 600,
    unlockLevel: 2,
    short: 'The database jumps straight to the newest entries instead of scanning every row.',
    effect: 'Database CPU, disk reads and latency stop growing with the Guestbook. Writes get slightly slower.',
    info: 'index'
  },
  archive: {
    id: 'archive',
    name: 'Archive old entries',
    icon: '🗃️',
    cost: 800,
    unlockLevel: 3,
    short: 'Keep only the newest 2,000 entries in the database; move older ones to cheap cold storage.',
    effect: 'The database stops growing: disk space, scans and responses stay flat. Old entries are still kept, just not in the hot database.',
    info: 'archive'
  },
  // ─── URL shortener ───
  base62: {
    id: 'base62',
    name: 'Short codes from IDs (Base62)',
    icon: '🔤',
    cost: 500,
    unlockLevel: Infinity,
    short: 'Make each code from the row\'s unique ID written in Base62 (0-9, a-z, A-Z) instead of hashing the long URL and checking if the code is taken.',
    effect: 'No more "is this code taken?" lookup on every new link: fewer database reads and faster creates. 7 characters give 3.5 trillion codes.',
    info: 'base62'
  },
  idRanges: {
    id: 'idRanges',
    name: 'Hand out ID ranges',
    icon: '📦',
    cost: 700,
    unlockLevel: Infinity,
    short: 'Each app server asks the ID generator for 1,000 IDs at a time and uses them locally.',
    effect: 'The ID generator gets 1,000× fewer calls. If a server dies, a few IDs are skipped: fine, codes only need to be unique.',
    info: 'idRanges'
  },
  expiry: {
    id: 'expiry',
    name: 'Expire old links',
    icon: '⏳',
    cost: 900,
    unlockLevel: Infinity,
    short: 'Free links expire after a while; a nightly cleanup job deletes them (expired codes answer "410 Gone").',
    effect: 'The database stops growing forever: only the newest links stay, so disks and scans stay flat.',
    info: 'expiry'
  },
  // ─── Cloud drive ───
  presigned: {
    id: 'presigned',
    name: 'Direct uploads (pre-signed URLs)',
    icon: '🔏',
    cost: 800,
    unlockLevel: Infinity,
    short: 'Your server hands the client a short-lived signed link; the client uploads and downloads straight to blob storage.',
    effect: 'File bytes stop passing through your app servers (and gateway): their network and CPU only handle small API calls.',
    info: 'presigned'
  },
  chunking: {
    id: 'chunking',
    name: 'Chunked, resumable uploads',
    icon: '🧩',
    cost: 1200,
    unlockLevel: Infinity,
    short: 'The client splits big files into 5–10 MB chunks, uploads them in parallel and remembers which ones are done.',
    effect: 'Big files no longer hit the request size limit or start over after a dropped connection. Users see a real progress bar.',
    info: 'chunking'
  },
  verifyUploads: {
    id: 'verifyUploads',
    name: 'Server-side chunk checks',
    icon: '🔍',
    cost: 1000,
    unlockLevel: Infinity,
    short: 'Don\'t trust the client\'s "chunk done". Ask blob storage which parts it really has (or listen for its upload events) before marking a chunk or file uploaded.',
    effect: 'No more files marked complete with a chunk missing. Blob storage does a little more work per upload.',
    info: 'verifyUploads'
  },
  compress: {
    id: 'compress',
    name: 'Compress before upload',
    icon: '🗜️',
    cost: 0,
    toggle: true,
    unlockLevel: Infinity,
    short: 'The client compresses files (Zstandard, Brotli, Gzip) before uploading. Text shrinks a lot; photos and videos are already compressed and barely shrink.',
    effect: 'About 15% fewer bytes uploaded and stored here, but every upload waits a little for the client to compress. Switch it on or off any time.',
    info: 'compress'
  },
  dedup: {
    id: 'dedup',
    name: 'Fingerprints and dedup',
    icon: '🧬',
    cost: 1500,
    unlockLevel: Infinity,
    short: 'Hash every chunk (SHA-256). If that fingerprint is already stored, skip the upload and point to the existing copy.',
    effect: 'Copies of the same file (very common) cost no upload bandwidth and no extra storage: about 40% less of both here.',
    info: 'dedup'
  },
  sharesTable: {
    id: 'sharesTable',
    name: 'Shares table',
    icon: '🤝',
    cost: 1000,
    unlockLevel: Infinity,
    short: 'Keep a separate table of (user → file shared with them) instead of a share list inside every file\'s metadata.',
    effect: '"Shared with me" becomes one indexed lookup instead of scanning every file. Database CPU stops growing with the number of files.',
    info: 'sharesTable'
  },
  deltaSync: {
    id: 'deltaSync',
    name: 'Delta sync',
    icon: '✂️',
    cost: 1500,
    unlockLevel: Infinity,
    short: 'When a file changes, send only the chunks that changed. Chunk boundaries follow the content (rolling hash), so a small edit only changes nearby chunks.',
    effect: 'Edits upload a fraction of the file: about 40% less upload traffic here.',
    info: 'deltaSync'
  },
  versions: {
    id: 'versions',
    name: 'Versions + conflicted copies',
    icon: '🗂️',
    cost: 1500,
    unlockLevel: Infinity,
    short: 'Keep old versions of each file. When two people edit the same file at once, keep both: the second becomes "file (conflicted copy)".',
    effect: 'No edit is ever lost. The cost: about 30% more storage and writes.',
    info: 'versions'
  },
  coldTier: {
    id: 'coldTier',
    name: 'Cold storage tier',
    icon: '🧊',
    cost: 2500,
    unlockLevel: Infinity,
    short: 'Move files nobody opened for months to a cheaper, slower storage class (like S3 Glacier / Coldline), with erasure coding instead of 3 full copies.',
    effect: 'Blob storage costs half as much to run. Opening an old file is a little slower.',
    info: 'coldTier'
  },
  // ─── News feed ───
  hybridFanout: {
    id: 'hybridFanout',
    name: 'Hybrid fan-out',
    icon: '🌟',
    cost: 1500,
    unlockLevel: Infinity,
    short: 'Don\'t copy posts from huge accounts into every follower\'s feed. Fetch them when a feed is read and merge them in.',
    effect: 'Celebrity posts stop costing ~1,000× the feed writes: the fan-out queue keeps up. Each feed read does a little more work (a few ms).',
    info: 'hybridFanout'
  },
  // ─── Ticketing ───
  holds: {
    id: 'holds',
    name: 'Hold seats during checkout',
    icon: '⏳',
    cost: 900,
    unlockLevel: Infinity,
    short: 'Picking a seat reserves it for 10 minutes (status + expires_at, or a lock with a TTL). Nobody else can buy it while you pay.',
    effect: 'No more seats sold twice. Each booking is two short writes (reserve, then confirm) instead of one.',
    info: 'holds'
  },
  searchIndex: {
    id: 'searchIndex',
    name: 'Search index',
    icon: '🔍',
    cost: 1200,
    unlockLevel: Infinity,
    short: 'Keep an inverted index of event names, artists and venues (full-text search, like Elasticsearch) instead of LIKE \'%taylor%\' on every row.',
    effect: 'Searches stop scanning every event: far less database work and fast results, even with typos.',
    info: 'searchIndex'
  },
  // ─── Ad clicks ───
  rollups: {
    id: 'rollups',
    name: 'Stream aggregation',
    icon: '🧮',
    cost: 1500,
    unlockLevel: Infinity,
    short: 'A stream processor (like Flink) reads clicks from the queue and keeps a count per ad per minute. Dashboards read those counts. Needs the message queue.',
    effect: 'Dashboard queries read a few pre-counted rows instead of scanning raw clicks: fast and cheap. The queue does a little more work per click.',
    info: 'rollups'
  },
  dedupIds: {
    id: 'dedupIds',
    name: 'Signed impression IDs',
    icon: '🪪',
    cost: 1200,
    unlockLevel: Infinity,
    short: 'Every ad shown gets a unique, signed impression ID. Before a click is counted, the cache is asked "seen this ID before?". Needs the cache.',
    effect: 'Double clicks and replays are counted once. The cache holds the recent IDs (memory) and answers one check per click.',
    info: 'dedupIds'
  },
  saltKeys: {
    id: 'saltKeys',
    name: 'Split hot ads',
    icon: '🧂',
    cost: 1000,
    unlockLevel: Infinity,
    short: 'Give a viral ad\'s clicks the key AdId:0…N so they spread over many queue partitions. The counts are added back together afterwards.',
    effect: 'One hot ad no longer overloads a single partition: the queue\'s work is spread evenly again.',
    info: 'saltKeys'
  },
  reconcile: {
    id: 'reconcile',
    name: 'Nightly reconciliation',
    icon: '🧾',
    cost: 1500,
    unlockLevel: Infinity,
    short: 'Archive every raw click to the data lake, and let a batch job recount them and correct the real-time totals. Needs the data lake.',
    effect: 'Clicks the stream lost (restarts, late events) are put back: the counts end up exact. The data lake stores every click.',
    info: 'reconcile'
  },
  redirect301: {
    id: 'redirect301',
    name: 'Permanent redirects (301)',
    icon: '↪️',
    cost: 0,
    toggle: true,
    unlockLevel: Infinity,
    short: 'Answer with "301 Moved Permanently" instead of "302 Found". Browsers remember a 301 and go straight to the long URL next time.',
    effect: 'About 40% of clicks never reach you: less load. But you never see those clicks, so analytics lose them. Switch it on or off any time.',
    info: 'redirect301'
  },
  // ─── AI agents ───
  compaction: {
    id: 'compaction',
    name: 'Summarize old messages',
    icon: '🗜️',
    cost: 700,
    unlockLevel: Infinity,
    short: 'Instead of sending the whole chat with every question, keep the last few messages and a short summary of the rest (compaction).',
    effect: 'Prompts get about 65% smaller: fewer tokens per answer, a smaller bill and faster answers. The agent still remembers what matters.',
    info: 'compaction'
  },
  rerank: {
    id: 'rerank',
    name: 'Rerank search results',
    icon: '🥇',
    cost: 1200,
    unlockLevel: Infinity,
    short: 'Fetch the top 20 matching chunks, then let a reranker pick the best few. Only those go into the prompt.',
    effect: 'Far fewer wrong or made-up answers (Anthropic measured 67% fewer failed lookups), and fewer document tokens per prompt. The knowledge base does more work per search.',
    info: 'rerank'
  },
  maxSteps: {
    id: 'maxSteps',
    name: 'Step limit for the agent loop',
    icon: '🛑',
    cost: 600,
    unlockLevel: Infinity,
    short: 'Stop any task after a few rounds of "think, use a tool, look at the result" and hand it to a person.',
    effect: 'A stuck agent can no longer burn thousands of tokens in a loop. Normal tasks finish as before.',
    info: 'maxSteps'
  },
  tokenBudget: {
    id: 'tokenBudget',
    name: 'Token budget per user',
    icon: '🎟️',
    cost: 900,
    unlockLevel: Infinity,
    short: 'Each user gets a daily token allowance. Scripts and power users that fire questions nonstop are slowed down once it runs out.',
    effect: 'One heavy user can no longer eat the whole plan\'s limit. About 90% of their extra questions are turned away.',
    info: 'tokenBudget'
  },
  promptCache: {
    id: 'promptCache',
    name: 'Prompt caching',
    icon: '♻️',
    cost: 1000,
    unlockLevel: Infinity,
    short: 'Mark the part of the prompt that repeats (instructions, tool list, older chat) as cacheable. The provider keeps it ready between calls.',
    effect: 'Cached tokens cost 10% of the normal price, don\'t count toward your tokens-per-minute limit, and are read much faster.',
    info: 'promptCache'
  },
  routing: {
    id: 'routing',
    name: 'Route easy questions to a small model',
    icon: '🔀',
    cost: 1200,
    unlockLevel: Infinity,
    short: 'A quick check sorts each question: easy ones ("opening hours?") go to a small, fast, cheap model; hard ones to the big model.',
    effect: 'Most questions cost about a third and come back about twice as fast. Answer quality drops a tiny bit.',
    info: 'routing'
  },
  humanApproval: {
    id: 'humanApproval',
    name: 'Human approval for refunds',
    icon: '🙋',
    cost: 800,
    unlockLevel: Infinity,
    short: 'Before the agent runs a risky tool that can\'t be undone (a refund over $50), it pauses and a person approves it.',
    effect: 'Even a tricked agent can\'t give away money. A few refunds take a little longer.',
    info: 'humanApproval'
  }
};

export function fixesForLevel(level) {
  return Object.values(CODE_FIXES).filter(f => (f.unlockLevel || 1) <= level);
}
