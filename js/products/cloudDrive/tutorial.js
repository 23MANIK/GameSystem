/**
 * Cloud Drive — the guided walkthrough for each level.
 */

import { SERVER_PARTS } from '../../data/serverParts.js';
import { CODE_FIXES } from '../../data/codeFixes.js';
import { newMachineSteps, ROLE_NAME, suggestedFix } from '../../game/Tutorial.js';

/** Levels whose new piece is a code change, not a machine. */
function fixSteps({ fix, welcome, buy, explain, extra = [] }) {
  return [
    { id: 'welcome', text: () => welcome, button: 'Show me' },
    {
      id: 'open',
      text: () => 'Tap <strong>Server</strong>. It opens on the <strong>Code fixes</strong> tab.',
      highlight: '#nav-server',
      builderTab: 'code',
      advanceOn: 'serverBuilderOpened'
    },
    {
      id: 'buy',
      fix,
      text: () => buy,
      highlight: '#nav-server',
      showInBuilder: true,
      advanceOn: 'codeFixBought'
    },
    ...extra,
    { id: 'explain', text: () => explain, highlight: '#nav-goals', button: 'Got it', finishAfterButton: true }
  ];
}

const LEVEL_1 = [
  {
    id: 'welcome',
    text: () => "Hi, I'm Archie! Let's build a <strong>cloud drive</strong> like Dropbox. It starts as <strong>one machine</strong> that runs the code, keeps the file list and stores every file.",
    button: "Let's build"
  },
  { id: 'open_builder', text: () => 'Tap <strong>Server</strong> at the bottom to open the Server Builder.', highlight: '#nav-server', advanceOn: 'serverBuilderOpened' },
  {
    id: 'pick_parts',
    text: () => 'A server is 4 parts: <strong>CPU</strong>, <strong>RAM</strong>, <strong>Storage</strong> and <strong>Network</strong>. Files are big: the disk holds their bytes and the network carries them. Pick parts and press <strong>Buy</strong>.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverBought'
  },
  { id: 'place', text: () => 'Now click the glowing slot to place your server.', advanceOn: 'serverPlaced' },
  {
    id: 'go_live',
    text: () => '<code>POST /files</code> uploads a file; <code>GET /files/{id}</code> downloads it. Each file is <strong>bytes</strong> (big) plus <strong>metadata</strong> (name, size, owner: tiny). Both live on this one disk for now.',
    highlight: '#hud-resources',
    button: 'Open to the public',
    onButton: gs => { gs.appLive = true; }
  },
  {
    id: 'grow',
    text: () => 'Complete every goal in <strong>Goals</strong>. Watch the <strong>disk space</strong>: files fill it fast. I\'ll tell you when a part gets busy.',
    highlight: '#nav-goals',
    button: 'Got it',
    minimizeAfterButton: true,
    advanceOn: 'partWarning'
  },
  {
    id: 'bottleneck',
    text: (gs, ctx) => {
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'storage'];
      const pct = Math.round((gs.serverStatus?.usage?.[part.id] || 0.8) * 100);
      return `${part.icon} <strong>${part.short}</strong> is at <strong>${pct}%</strong>: your bottleneck. ${part.whenFull} Tap <strong>Server</strong> and buy a bigger ${part.short}.`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverUpgraded'
  },
  {
    id: 'scaled',
    text: () => 'That\'s <strong>vertical scaling</strong>. But a server disk only holds a few hundred files: keep an eye on disk space. Check <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_2 = [
  {
    id: 'welcome',
    text: () => 'Level 2! A file is thousands of times bigger than its details, yet both sit on one small disk. Split them: <strong>blob storage</strong> for bytes, a <strong>database</strong> for metadata.',
    button: 'Show me'
  },
  { id: 'open', text: () => 'Tap <strong>Server</strong>. It opens on the new <strong>🪣 Blob</strong> tab.', highlight: '#nav-server', advanceOn: 'serverBuilderOpened' },
  {
    id: 'buy',
    role: 'blob',
    text: () => 'Blob storage is built for big files: huge space, very durable, cheap to run per GB (like S3). Its <strong>disk size</strong> decides how many files fit; its <strong>network</strong> carries the bytes.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'machineBought'
  },
  { id: 'place', role: 'blob', text: () => 'Click the glowing slot to place blob storage.', advanceOn: 'machinePlaced' },
  {
    id: 'buy_db',
    text: () => 'Now the <strong>Database</strong> tab: metadata rows (name, size, owner, where the bytes are) are tiny. A small database is plenty.',
    highlight: '#nav-server',
    builderTab: 'db',
    showInBuilder: true,
    advanceOn: 'dbBought'
  },
  { id: 'place_meta', text: () => 'Click the glowing slot to place the database.', advanceOn: 'dbPlaced' },
  {
    id: 'done',
    text: () => 'Bytes in blob storage, metadata in the database. As files pile up, the database must find rows fast: an <strong>index</strong> (Code fixes) helps. Check <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_3 = fixSteps({
  fix: 'presigned',
  welcome: 'Level 3! Photos and videos: files are 5–10× bigger. Every upload goes client → <strong>app server</strong> → blob storage, and downloads the reverse. Your app servers are just carrying bytes.',
  buy: 'Buy <strong>🔏 Direct uploads (pre-signed URLs)</strong>. Your server signs a short-lived link; the client uploads straight to blob storage. Watch the arrows on the map change.',
  explain: 'Bytes now flow directly between users and blob storage. Your app server only checks permissions and signs links. Check its network in <strong>Goals</strong>.'
});

const LEVEL_4 = newMachineSteps({
  role: 'gateway',
  welcome: 'Level 4! A quarter of uploads are now <strong>multi-GB</strong>. As one request they hit size limits (gateways cap bodies near 10 MB), time out, and restart from zero when Wi-Fi drops.',
  buy: 'The API gateway routes, authenticates and rate-limits every call. It is also where the <strong>request size limit</strong> lives: big files can\'t pass in one piece.',
  extra: [{
    id: 'lb',
    role: 'lb',
    text: () => 'Your design\'s front door is <strong>gateway + load balancer</strong>. Open <strong>Server → ⚖️ LB</strong> and buy a small load balancer: later you can add app servers behind it.',
    highlight: '#nav-server',
    builderTab: 'lb',
    showInBuilder: true,
    advanceOn: 'machineBought'
  }, {
    id: 'place_lb',
    role: 'lb',
    text: () => 'Click the glowing slot to place the load balancer.',
    advanceOn: 'machinePlaced'
  }, {
    id: 'chunk',
    fix: 'chunking',
    text: () => 'Now <strong>Server → Code fixes → 🧩 Chunked uploads</strong>. The client splits files into 5–10 MB chunks, uploads them in parallel, and resumes after a failure.',
    highlight: '#nav-server',
    builderTab: 'code',
    showInBuilder: true,
    advanceOn: 'codeFixBought'
  }],
  explain: 'Big files upload in chunks with a real progress bar, and a dropped connection resumes from the last chunk. Check <strong>Goals</strong>.'
});

const LEVEL_5 = fixSteps({
  fix: 'verifyUploads',
  welcome: 'Level 5! "My file won\'t open." Clients report "chunk done" after each chunk, and you believe them. But clients crash, retry and double-report: <strong>1 in 25 files</strong> is marked complete with a chunk missing.',
  buy: 'Buy <strong>🔍 Server-side chunk checks</strong>. Before marking a chunk or file uploaded, ask blob storage which parts it really has.',
  explain: 'The metadata now only says "uploaded" when the bytes really exist. Goals counts files stored with none broken.'
});

const LEVEL_6 = fixSteps({
  fix: 'dedup',
  welcome: 'Level 6! Storage is your biggest bill, and much of it is <strong>copies</strong>: the same photos, installers and shared folders uploaded by many people.',
  buy: 'Buy <strong>🧬 Fingerprints and dedup</strong>. Each chunk gets a SHA-256 fingerprint; if it is already stored, the upload is skipped. Also try the <strong>🗜️ compression switch</strong>: fewer bytes, but uploads wait a little.',
  explain: 'Copies now cost nothing to upload or store. Keep an eye on blob storage\'s disk in <strong>Goals</strong>.'
});

const LEVEL_7 = newMachineSteps({
  role: 'cache',
  welcome: 'Level 7! Teams share everything. "Shared with me" is opened all day, and each time the database <strong>scans every file\'s share list</strong>.',
  buy: 'A cache keeps hot share lists in memory, so repeat requests skip the database.',
  extra: [{
    id: 'shares',
    fix: 'sharesTable',
    text: () => 'The cache helps, but each miss still scans every file. <strong>Server → Code fixes → 🤝 Shares table</strong>: one row per (user, file shared with them) makes it one lookup.',
    highlight: '#nav-server',
    builderTab: 'code',
    showInBuilder: true,
    advanceOn: 'codeFixBought'
  }],
  explain: 'Shares live in their own table, hot lists come from the cache. The shares table is also your access list: only users in it get download links.'
});

const LEVEL_8 = newMachineSteps({
  role: 'sync',
  welcome: 'Level 8! Users have <strong>3 devices each</strong>, and every device asks "anything new?" every 5 seconds. That\'s thousands of requests a second, mostly finding nothing, and edits still arrive late.',
  buy: 'The sync server keeps <strong>one live connection per device</strong> and pushes "file changed" instantly. Idle connections still use <strong>RAM</strong>, so RAM is what it needs most.',
  extra: [{
    id: 'delta',
    fix: 'deltaSync',
    text: () => 'Half of uploads are edits. <strong>Code fixes → ✂️ Delta sync</strong> uploads only the chunks that changed (chunk boundaries follow the content, so an edit only moves nearby chunks).',
    highlight: '#nav-server',
    builderTab: 'code',
    showInBuilder: true,
    advanceOn: 'codeFixBought'
  }],
  explain: 'Devices hear about changes in about a second, polls almost vanish, and edits upload a fraction of the file. Check <strong>Goals</strong>.'
});

const LEVEL_9 = fixSteps({
  fix: 'versions',
  welcome: 'Level 9! Two people edit the same file offline and both save. <strong>Last write wins</strong>: one edit silently vanishes.',
  buy: 'Buy <strong>🗂️ Versions + conflicted copies</strong>. Every save is kept; a clashing save becomes "file (conflicted copy)" instead of overwriting.',
  explain: 'No edit is ever lost. The price: ~30% more storage and writes. Watch blob storage\'s disk.'
});

const LEVEL_10 = fixSteps({
  fix: 'coldTier',
  welcome: 'Level 10! Most stored files are never opened again, yet they sit on your most expensive storage. And every list, poll and upload hits <strong>one metadata database</strong>.',
  buy: 'Buy <strong>🧊 Cold storage tier</strong>: old files move to cheaper, slower storage, halving blob storage\'s running cost.',
  extra: [{
    id: 'add_shards',
    text: () => 'Now <strong>Server → Database tab → Add shard</strong>. Split metadata by user across shards so each handles a slice. Aim for 3.',
    highlight: '#nav-server',
    builderTab: 'db',
    showInBuilder: true,
    advanceOn: 'dbShardPlaced'
  }],
  explain: 'Bytes are cheaper, metadata is split. The system now scales in both storage and requests.'
});

const LEVEL_11 = newMachineSteps({
  role: 'cdn',
  welcome: 'Level 11! Public share links go viral, and <strong>half your users are far away</strong> (~120 ms).',
  buy: 'A CDN serves popular public files from edges near each user, using signed links that expire in minutes. Private files are rarely re-read, so they still come from blob storage.',
  explain: 'Popular files come from nearby edges. You built the architecture behind Dropbox and Google Drive!'
});

export const CLOUD_DRIVE_STEPS = {
  1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4, 5: LEVEL_5, 6: LEVEL_6,
  7: LEVEL_7, 8: LEVEL_8, 9: LEVEL_9, 10: LEVEL_10, 11: LEVEL_11
};

// The new machine each level is about (levels whose new piece is a code fix have none)
export const CLOUD_DRIVE_LEVEL_ROLE = { 1: 'app', 2: 'blob', 4: 'gateway', 7: 'cache', 8: 'sync', 11: 'cdn' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
export function cloudDriveSuggestedFix(gs, role, partId) {
  const owned = id => gs.codeFixes[id] || CODE_FIXES[id].unlockLevel > gs.level;
  if (role === 'app' && (partId === 'network' || partId === 'cpu') && !owned('presigned')) return CODE_FIXES.presigned;
  if (role === 'db' && partId === 'cpu' && !owned('sharesTable')) return CODE_FIXES.sharesTable;
  if (role === 'db' && !owned('index')) return CODE_FIXES.index;
  if (role === 'blob' && partId === 'network' && !owned('dedup')) return CODE_FIXES.dedup;
  return null;
}
