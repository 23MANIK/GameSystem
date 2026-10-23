/**
 * Cloud Drive — words and explanations that differ from the shared ones.
 */

export const CLOUD_DRIVE_VOCAB = {
  record: 'file',
  records: 'files',
  writeFails: 'every upload fails',
  readName: 'download'
};

export const CLOUD_DRIVE_INCIDENTS = {
  spike: [
    { name: 'Back to school', story: 'Millions of students are uploading assignments at once.', mult: 1.5 },
    { name: 'Viral folder', story: 'A shared folder of wallpapers is going around social media.', mult: 1.8 },
    { name: 'Phone launch', story: 'A new phone ships with your app, and everyone backs up their photos on day one.', mult: 2.0, minUsers: 80 }
  ],
  bots: [
    { name: 'Hotlinking', story: 'Other websites embed your public download links.', mult: 3 }
  ],
  crash: [
    { name: 'App server crashed', story: 'One of your app servers ran out of memory and crashed.', crashed: 1 }
  ]
};

export const CLOUD_DRIVE_ROLE_TEXT = {
  app: { job: 'Runs your code: checks who may do what, signs upload and download links, records file metadata.' },
  db: { job: 'Holds the metadata: file names, sizes, owners, shares, versions, and where each file\'s bytes are.' },
  cache: { job: 'Keeps hot share lists and folder listings in memory, so most never reach the database.' },
  cdn: { job: 'Serves popular public files from servers near each user, with signed links that expire.' },
  gateway: { job: 'Front door for every API call: routing, authentication, rate limits, and a request size limit.' }
};

export const CLOUD_DRIVE_PART_TEXT = {
  storage: { whatItDoes: 'Disk speed and space. Files are big: on a server disk only a few hundred fit. Blob storage holds tens of thousands.' },
  network: { whatItDoes: 'The pipe to the internet. Uploads and downloads are big, so whatever carries the bytes needs a big pipe.' }
};

export const CLOUD_DRIVE_FIX_TEXT = {
  index: {
    name: 'Index on owner and folder',
    short: 'Index metadata by (owner, folder), so listing a folder or finding a file jumps straight to its rows instead of scanning every file.',
    effect: 'Database CPU, disk reads and latency stop growing with the number of files.'
  }
};

export const CLOUD_DRIVE_EXPLANATIONS = {
  storage: {
    title: '💾 Storage',
    body: `<p>Where data is saved. For a drive, files are big: a server disk fills after a few hundred files, while blob storage holds tens of thousands (in this game's scale).</p>
      <p>Disk <strong>speed</strong> decides how fast files are read and written; disk <strong>space</strong> decides how many fit.</p>
      <p class="info-eg">Real world: 500M users × 5 GB ≈ 2.5 exabytes. That's why storage cost drives every decision.</p>`
  },
  feature: {
    title: 'How a cloud drive uses your system',
    body: `<ul><li><code>POST /files</code>: upload a file. A big write: network and disk.</li>
      <li><code>GET /files/{id}</code>: download it. A big read.</li>
      <li>Every file is <strong>bytes</strong> (big, go to blob storage) plus <strong>metadata</strong> (small rows in a database).</li></ul>
      <p>Later: sharing, sync across devices, and edits that clash.</p>`
  },
  database: {
    title: '🗄️ Metadata database',
    body: `<p>Holds the small facts about each file: name, size, type, owner, folder, status ("uploading" / "uploaded"), chunks, and the key where the bytes live in blob storage.</p>
      <p>DynamoDB or PostgreSQL both work. Metadata traffic (lists, checks, polls) is far bigger than file traffic, so this is what you eventually shard.</p>`
  },
  diskSpace: {
    title: '💽 Disk space',
    body: `<p>Every stored file uses space: on a server disk each takes a large slice (its bytes); in blob storage you get far more room per coin.</p>
      <p>When it's full, <strong>every upload fails</strong>. Fixes: bigger disks, blob storage, dedup (store copies once), cold storage.</p>`
  },
  index: {
    title: '🔎 Metadata index',
    body: `<p>Without an index, listing a folder or finding a file reads every metadata row. Index by (owner, folder) and the database jumps straight to the right rows.</p>`
  },
  cache: {
    title: '⚡ Cache',
    body: `<p>Memory in front of the database (Redis). For a drive it holds hot share lists and folder listings, opened again and again.</p>
      <p>The bytes themselves are not cached here: they're big and mostly private. Public files go to a CDN instead.</p>`
  },
  cdn: {
    title: '🌍 CDN for files',
    body: `<p>Edge servers near users keep copies of files that are downloaded many times: public links, viral folders.</p>
      <p>Most drive files are private and re-read only by their owner, so a CDN helps far less than for a website. <strong>Measure</strong> before paying for one. Downloads use signed URLs that expire in minutes.</p>`
  }
};
