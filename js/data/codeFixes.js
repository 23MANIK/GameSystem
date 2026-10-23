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
  }
};

export function fixesForLevel(level) {
  return Object.values(CODE_FIXES).filter(f => (f.unlockLevel || 1) <= level);
}
