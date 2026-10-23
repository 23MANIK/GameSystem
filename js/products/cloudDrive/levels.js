/**
 * Cloud Drive (like Dropbox / Google Drive) — the levels.
 *
 * Base source: Hello Interview, "Design Dropbox" (levels 1–8 follow its
 * requirements, bad → good → great options and deep dives). Levels 9–11 are
 * extras from other sources. See docs/products/cloud-drive.md.
 *
 *   1. My First Upload      — one server holds code, metadata and files
 *   2. Bytes vs Metadata    — blob storage for bytes, a database for metadata
 *   3. Direct Uploads       — pre-signed URLs: bytes skip your servers
 *   4. Big Files            — API gateway limits, chunked resumable uploads
 *   5. Trust but Verify     — server-side chunk verification
 *   6. Same Files Everywhere — fingerprints, dedup, compression
 *   7. Sharing              — shares table and a cache
 *   8. Sync Everywhere      — sync server (WebSockets), delta sync
 *   9. Two Edits at Once    — versions and conflicted copies        (extra)
 *  10. Exabytes for Less    — cold storage tier, sharded metadata   (extra)
 *  11. Downloads Worldwide  — CDN for public links, signed URLs     (extra)
 *
 * Sizes are game-scaled: readKB / writeKB are "KB" in the simulator, standing
 * in for real file sizes of MB–GB. Each level's realWorld notes give the real ones.
 */

// Downloads and uploads of whole files; metadata calls are cheap
const FILES = { readKind: 'file', appCallCost: 0.3, dbReadCost: 0.1, recordSpace: 20, blobSpaceMult: 100 };

export const CLOUD_DRIVE_LEVELS = [
  {
    level: 1,
    name: 'My First Upload',
    subtitle: 'One server stores files and their details',
    intro: 'One machine runs the code, keeps the file list AND stores every file.',
    mode: 'single-server',
    serverMode: true,
    userTarget: 100,
    userGrowthRate: 2,
    audience: 130,
    spikeRange: [1.2, 1.4],
    startingCoins: 500,
    coinRate: 25,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.005,
    readKB: 150,
    writeKB: 300,
    unlockedComponentIds: ['monolith'],
    unlockedFeatures: ['Upload', 'Download'],
    feature: {
      name: 'Upload and download',
      summary: 'Users upload files from any device and download them anywhere. Each file is two things: its bytes, and its metadata (name, size, owner).',
      endpoints: [
        { method: 'POST', path: '/files', does: 'Upload a file', rate: 'writesPerSec' },
        { method: 'GET', path: '/files/{id}', does: 'Download a file', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Files are big: photos are a few MB, videos GBs. Hello Interview designs for files up to 50 GB.',
      'Availability matters more than consistency here: if a file shows up on another device a few seconds late, nobody is hurt.'
    ],
    story: 'Every cloud drive starts as one machine: it runs the code, keeps the list of files AND stores every file on its own disk. Build it and grow to 100 users.',
    completionMessage: 'One server stores and serves files for 100 users. But files are big: the disk fills fast and every byte goes through the one machine. Next: splitting bytes from metadata.'
  },

  {
    level: 2,
    name: 'Bytes vs Metadata',
    subtitle: 'Blob storage for files, a database for their details',
    intro: 'Files are huge and the details are tiny, but both live on one small disk.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 400,
    userGrowthRate: 4,
    audience: 500,
    startingCoins: 0,
    coinRate: 5,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.01,
    readKB: 150,
    writeKB: 300,
    unlockedComponentIds: ['object_storage', 'database'],
    unlockedFeatures: ['Blob storage', 'Metadata database', 'Index'],
    realWorld: [
      'Store bytes in blob storage (S3, GCS) at ~$0.02 per GB-month with 11 nines of durability; store metadata in a database (DynamoDB or PostgreSQL both work).',
      'Rule of thumb: anything over ~10 MB that you never query with SQL belongs in blob storage, not a database.'
    ],
    story: 'Uploads doubled. A file is thousands of times bigger than its details, yet both sit on one small server disk that is almost full. Put the bytes in blob storage and the details in a database.',
    completionMessage: 'Bytes live in cheap, huge blob storage; the database only keeps small metadata rows. But every byte still passes through your app server on its way in and out.'
  },

  {
    level: 3,
    name: 'Direct Uploads',
    subtitle: 'Pre-signed URLs: bytes skip your servers',
    intro: 'Photos and videos now: every byte travels through your app server twice.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 600,
    userGrowthRate: 5,
    audience: 750,
    startingCoins: 0,
    coinRate: 4,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.01,
    readKB: 1000,
    writeKB: 2000,
    unlockedComponentIds: [],
    unlockedFeatures: ['Pre-signed URLs'],
    feature: {
      name: 'Photos and videos',
      summary: 'Users now sync photos and videos: files are 5–10× bigger. Your app server receives every upload and passes it on to blob storage, then does the same for every download.',
      endpoints: [
        { method: 'POST', path: '/files', does: 'Ask to upload (get a signed URL)', rate: 'writesPerSec' },
        { method: 'PUT', path: 'blob/{key}', does: 'Upload bytes', rate: 'uploadMBPerSec' },
        { method: 'GET', path: '/files/{id}', does: 'Download a file', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Signing a URL is a local cryptographic step: no call to S3. The signed link names one object, one action and an expiry of minutes.',
      'Your service becomes the control plane (who may do what); blob storage is the data plane (the bytes).'
    ],
    story: 'Users sync photos and videos now. Every upload goes client → app server → blob storage, and every download the reverse. Your app servers spend their network and CPU just passing bytes along.',
    completionMessage: 'Clients now upload and download straight to blob storage with short-lived signed links. Your app servers only check permissions and sign URLs: a fraction of the work.'
  },

  {
    level: 4,
    name: 'Big Files',
    subtitle: 'A front door (gateway + load balancer), chunked uploads',
    intro: 'A quarter of uploads are now huge, and they fail at the size limit or when Wi-Fi drops.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1000,
    userGrowthRate: 8,
    audience: 1250,
    startingCoins: 0,
    coinRate: 4,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.01,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unlockedComponentIds: ['rate_limiter', 'load_balancer'],
    unlockedFeatures: ['API gateway', 'Load balancer', 'Chunked uploads'],
    feature: {
      name: 'Big files',
      summary: 'Video creators upload multi-GB files. One huge request hits size limits (API gateways often cap bodies near 10 MB), times out, and starts from zero after any network blip.',
      endpoints: [
        { method: 'POST', path: '/files', does: 'Start an upload', rate: 'writesPerSec' },
        { method: 'PUT', path: 'blob/{key}?part=N', does: 'Upload one chunk', rate: 'uploadMBPerSec' },
        { method: 'GET', path: '/files/{id}', does: 'Download (resume with Range)', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      '50 GB over 100 Mbps is 50 × 8 / 100 = 4,000 s ≈ 1.1 hours: far too long for one request.',
      'S3 multipart upload: parts of 5 MB–5 GB, up to 10,000 parts, uploaded in parallel, then assembled. Downloads resume with HTTP Range requests.'
    ],
    story: 'Video creators joined. A quarter of uploads are now multi-GB: as one request they hit the size limit, time out, or restart from zero when the Wi-Fi drops. Put a proper front door in place (API gateway + load balancer) and teach the client to upload in chunks.',
    completionMessage: 'Big files go up in chunks, in parallel, with a real progress bar, and a dropped connection resumes where it left off. Next: why upload the same file twice?'
  },

  {
    level: 5,
    name: 'Trust but Verify',
    subtitle: 'The server checks every chunk really arrived',
    intro: 'Some files say "uploaded" but a chunk never made it, so they open broken.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1200,
    userGrowthRate: 10,
    audience: 1500,
    startingCoins: 0,
    coinRate: 4,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.015,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    unlockedComponentIds: [],
    unlockedFeatures: ['Server-side chunk checks'],
    feature: {
      name: 'Upload status',
      summary: 'After each chunk, the client tells your API "chunk N done" and you mark it uploaded. Clients crash, retry and lie, so some files are marked complete with a chunk missing.',
      endpoints: [
        { method: 'PATCH', path: '/files/{id}/chunks', does: 'Client reports a chunk done', rate: 'writesPerSec' },
        { method: 'EVT', path: 'blob: part stored', does: 'Storage confirms the chunk', rate: 'writesPerSec' },
        { method: 'GET', path: '/files/{id}', does: 'Download (broken if a chunk is missing)', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'Good: trust the client\'s PATCH after each chunk. Great: verify with the storage itself (S3 ListParts or upload event notifications) before marking a chunk or file done.',
      'Only mark the file "uploaded" after storage confirms the assembled object; clean up uploads that were started and abandoned.'
    ],
    story: 'Support tickets: "my file won\'t open". Your metadata trusts what clients report, but clients crash mid-upload, retry, or double-report. About 1 in 25 files is marked complete with a chunk missing.',
    completionMessage: 'Chunks and files are only marked done when blob storage confirms them. The metadata always matches the bytes that really exist.'
  },

  {
    level: 6,
    name: 'Same Files Everywhere',
    subtitle: 'Fingerprints and dedup',
    intro: 'The same photos and installers are uploaded and stored again and again.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1500,
    userGrowthRate: 12,
    audience: 1900,
    startingCoins: 0,
    coinRate: 4,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.012,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    unlockedComponentIds: [],
    unlockedFeatures: ['Fingerprints', 'Dedup', 'Compression switch'],
    realWorld: [
      'A SHA-256 fingerprint identifies content, not names: two users uploading the same file produce the same hash, so it is stored once.',
      'Large drives report big dedup savings; the System Design Handbook estimate assumes ~40% (2.5 EB of user data → ~4.5 EB on disk after 3 copies and dedup).'
    ],
    story: 'Storage is now your biggest bill, and a lot of it is copies: the same photos, the same installers, the same shared folders, uploaded again and again by different people.',
    completionMessage: 'Each chunk has a fingerprint. Already-stored chunks are never uploaded or stored again, which saves bandwidth and storage on every copy.'
  },

  {
    level: 7,
    name: 'Sharing',
    subtitle: 'A shares table and a cache',
    intro: 'Teams share everything, and "Shared with me" scans every file you store.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2000,
    userGrowthRate: 15,
    audience: 2500,
    startingCoins: 0,
    coinRate: 4,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.012,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    listReadsPerUser: 0.05,
    cacheHitRate: 0.85,
    unlockedComponentIds: ['redis_cache'],
    unlockedFeatures: ['Sharing', 'Shares table', 'Cache'],
    feature: {
      name: 'Sharing',
      summary: 'Users share files and folders by email. Each share is stored in the file\'s own metadata, so listing "Shared with me" means looking through every file.',
      endpoints: [
        { method: 'POST', path: '/files/{id}/share', does: 'Share with users', rate: 'writesPerSec' },
        { method: 'GET', path: '/shared-with-me', does: 'List files shared with you', rate: 'listsPerSec' },
        { method: 'GET', path: '/files/{id}', does: 'Download', rate: 'readsPerSec' }
      ]
    },
    realWorld: [
      'A share list inside each file is easy to write but slow to read; a separate (userId → fileId) table answers "shared with me" with one indexed lookup.',
      'The shares table is also your access-control list: downloads are only signed for users it allows.'
    ],
    story: 'Teams moved in and share everything. "Shared with me" is opened all day, and each time the database looks through every file\'s share list. It is drowning.',
    completionMessage: 'Shares live in their own table, keyed by the person they were shared with, and hot lists come from the cache. "Shared with me" is one quick lookup.'
  },

  {
    level: 8,
    name: 'Sync Everywhere',
    subtitle: 'A sync server pushes changes; send only what changed',
    intro: 'Every device asks "anything new?" constantly, and changes still arrive late.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3000,
    userGrowthRate: 20,
    audience: 3700,
    startingCoins: 0,
    coinRate: 5,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.012,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    listReadsPerUser: 0.05,
    cacheHitRate: 0.85,
    devicesPerUser: 3,
    pollPerDevice: 0.2,
    unlockedComponentIds: ['sync_server'],
    unlockedFeatures: ['Desktop and phone sync', 'Sync server', 'Delta sync'],
    feature: {
      name: 'Sync across devices',
      summary: 'Every user has ~3 devices (laptop, phone, tablet) that must stay in sync. Each device asks "anything new since my last sync?" every 5 seconds.',
      endpoints: [
        { method: 'GET', path: '/files/changes?since=', does: 'Poll for changes', rate: 'pollsPerSec' },
        { method: 'EVT', path: 'push: file changed', does: 'Notify devices', rate: 'writesPerSec' },
        { method: 'POST', path: '/files', does: 'Upload a change', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'One WebSocket (or SSE) per device, not per file, pushes change notices; a slow poll every few minutes catches anything a dropped connection missed.',
      'Dropbox spent about four years rewriting its desktop sync engine (Nucleus, 2020) around a strict data model and stable file IDs, tested with millions of random simulations a day.'
    ],
    story: 'Users run the app on laptops, phones and tablets. Every device polls "anything new?" every few seconds. That\'s thousands of requests a second, most of them finding nothing, and edits still show up late.',
    completionMessage: 'Devices hold one live connection to the sync server and hear about changes instantly. Edits upload only the chunks that changed.'
  },

  {
    level: 9,
    name: 'Two Edits at Once',
    subtitle: 'Versions and conflicted copies',
    intro: 'Two people save the same file and one edit silently disappears.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3500,
    userGrowthRate: 20,
    audience: 4300,
    startingCoins: 0,
    coinRate: 5,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.012,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    listReadsPerUser: 0.05,
    cacheHitRate: 0.85,
    devicesPerUser: 3,
    pollPerDevice: 0.2,
    conflictShare: 0.05,
    unlockedComponentIds: [],
    unlockedFeatures: ['Versions', 'Conflicted copies'],
    realWorld: [
      'Options: last write wins (simple, loses data), version branches, automatic merging (OT / CRDTs, for documents like Google Docs), or a "conflicted copy" file (Dropbox, for any file type).',
      'Versions cost storage: full snapshots are fast to restore but big; storing only changed chunks is smaller.'
    ],
    story: 'Shared folders are busy. When two people edit the same file offline and both save, the last save silently overwrites the other. Support tickets: "my changes vanished!"',
    completionMessage: 'Every save is kept as a version, and clashing saves become a conflicted copy instead of overwriting. Nobody loses work again.'
  },

  {
    level: 10,
    name: 'Exabytes for Less',
    subtitle: 'Cold storage tier, sharded metadata',
    intro: 'The storage bill is huge, and the metadata database is the new bottleneck.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 5000,
    userGrowthRate: 25,
    audience: 6200,
    startingCoins: 0,
    coinRate: 7,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.012,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    listReadsPerUser: 0.08,
    browsePerUser: 0.15,
    cacheHitRate: 0.85,
    devicesPerUser: 3,
    pollPerDevice: 0.2,
    conflictShare: 0.05,
    unlockedComponentIds: ['db_shard'],
    unlockedFeatures: ['Cold storage', 'Metadata shards'],
    realWorld: [
      'Metadata traffic far exceeds file traffic: the Handbook\'s estimate is ~60,000 metadata queries/s vs ~3,000 file operations/s. Shard metadata by user or folder.',
      'Dropbox moved off S3 to its own exabyte-scale store, Magic Pocket, to cut cost; most real files are cold, so cold tiers and erasure coding (~1.5× instead of 3 copies) save a lot.'
    ],
    story: 'You store a huge amount, and most of it is never opened again, yet it all sits on your most expensive storage. Meanwhile every listing, poll and upload hits one metadata database.',
    completionMessage: 'Old files live on cheap cold storage, and metadata is split across shards. The system scales in both bytes and requests.'
  },

  {
    level: 11,
    name: 'Downloads Worldwide',
    subtitle: 'A CDN for public links',
    intro: 'Public share links go viral, and half your users are far away.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 6000,
    userGrowthRate: 30,
    audience: 7000,
    startingCoins: 0,
    coinRate: 7,
    ...FILES,
    readsPerUser: 0.04,
    writesPerUser: 0.012,
    readKB: 1000,
    writeKB: 5000,
    bigFileShare: 0.25,
    unverifiedShare: 0.04,
    listReadsPerUser: 0.08,
    browsePerUser: 0.15,
    cacheHitRate: 0.85,
    devicesPerUser: 3,
    pollPerDevice: 0.2,
    conflictShare: 0.05,
    publicShare: 0.5,
    globalShare: 0.5,
    distanceMs: 120,
    unlockedComponentIds: ['cdn'],
    unlockedFeatures: ['CDN', 'Signed download links'],
    realWorld: [
      'A CDN only pays off for files read many times: public links and cross-region sharing. Private files are mostly re-read by their owner, so measure before adding one.',
      'Downloads use CDN signed URLs that expire in minutes. They are bearer tokens, so add IP binding or cookies when the stakes are high.'
    ],
    story: 'Public share links go viral, and half your users are on other continents, ~120 ms away. Popular files are downloaded thousands of times from one region.',
    completionMessage: 'Popular files are served from edges near every user with short-lived signed links. You built the architecture behind Dropbox and Google Drive!'
  }
];
