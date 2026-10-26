/**
 * Cloud Drive — the goals each level must meet (see js/game/Challenges.js).
 */

import {
  placedChallenge, usersChallenge, latencyChallenge, incidentChallenge, profitChallenge, cpuAtUsers
} from '../../game/Challenges.js';

function filesStored(target, hint, info = 'diskSpace') {
  return {
    id: 'files',
    icon: '📁',
    info,
    label: `Store ${target.toLocaleString()} files`,
    hint,
    progress: gs => ({ value: gs.guestbook.count, target, unit: 'files' })
  };
}

function fixOwned(id, icon, info, label, hint) {
  return {
    id: `fix-${id}`,
    icon,
    info,
    label,
    hint,
    progress: gs => ({ value: gs.codeFixes[id] ? 1 : 0, target: 1, unit: '', display: gs.codeFixes[id] ? 'Done' : 'Not yet' })
  };
}

/** A condition that must hold while at least `users` are online. */
function whileBusy(id, icon, info, label, hint, users, test, show) {
  return {
    id,
    icon,
    info,
    label,
    hint,
    progress: gs => {
      const st = gs.serverStatus;
      const ok = Boolean(st) && gs.users >= users && test(st, gs);
      return { value: ok ? 1 : 0, target: 1, unit: '', display: st ? `${show(st, gs)} at ${gs.users.toLocaleString()} users` : '–' };
    }
  };
}

const pct = v => `${Math.round(v * 100)}%`;

export const CLOUD_DRIVE_CHALLENGES = {
  1: [
    usersChallenge(100, 'Users stop growing at your server\'s limit. Open Server and upgrade the part marked "runs out first".'),
    filesStored(150, 'Each file takes a big piece of the disk (it holds the bytes). SSDs are fast but small; NVMe holds more.', 'storage'),
    latencyChallenge(80, 100, 'Latency climbs once any part is past ~70% busy. Downloads need disk speed and network.'),
    incidentChallenge('spike', {
      hint: 'About 130 people use your drive, and a spike adds 20–40% for 20 seconds. Build room for ~180 users.'
    }),
    profitChallenge(1000, 'Profit = revenue − running cost − outage penalties. Only buy the parts you need.')
  ],

  2: [
    placedChallenge('blob', '🪣', 'Store file bytes in blob storage', 'Open Server → Blob tab and place it. File bytes move there; it holds far more, far more cheaply.'),
    placedChallenge('db', '🗄️', 'Keep metadata in its own database', 'Open Server → Database tab. Names, sizes and owners are tiny rows; they belong in a database.'),
    usersChallenge(400, 'Check which machine "runs out first" in the Server Builder.'),
    filesStored(2000, 'A server disk holds only a few hundred files. Blob storage holds tens of thousands.'),
    profitChallenge(800, 'Blob storage is cheap to run per GB. Code fixes are one-time costs.')
  ],

  3: [
    fixOwned('presigned', '🔏', 'presigned', 'Upload and download directly with pre-signed URLs',
      'Server → Code fixes. Your server signs a short-lived link; the client talks to blob storage directly.'),
    whileBusy('app-net', '🌐', 'presigned', 'App server network under 10% with 600+ users',
      'Right now every byte goes through the app server. With direct uploads, it only handles small API calls.',
      600, st => (st.servers.app?.usage.network ?? 1) < 0.1, st => `App network ${pct(st.servers.app?.usage.network ?? 0)}`),
    usersChallenge(600, 'Bigger files now: watch the app server\'s network and CPU.'),
    profitChallenge(800, 'Carrying bytes needs big network cards. Signing URLs needs almost nothing.')
  ],

  4: [
    placedChallenge('gateway', '🚦', 'Put an API gateway at the front door', 'Server → Gateway tab. It routes, authenticates and rate-limits. Its request size limit is why big uploads must be split.'),
    fixOwned('chunking', '🧩', 'chunking', 'Upload big files in chunks', 'Server → Code fixes → Chunked uploads. The client splits files into 5–10 MB pieces and resumes after failures.'),
    whileBusy('uploads-ok', '🛡️', 'chunking', 'Under 1% failed requests with 1,000+ users',
      'A quarter of uploads are huge: as one request they fail. Chunked uploads fix it.',
      1000, st => st.errorRate < 0.01, st => `${(st.errorRate * 100).toFixed(1)}% failing`),
    usersChallenge(1000, 'Upload traffic is heavy now; blob storage\'s network may need an upgrade.'),
    profitChallenge(1500, 'Failed uploads earn nothing and cost refunds.')
  ],

  5: [
    fixOwned('verifyUploads', '🔍', 'verifyUploads', 'Verify chunks with blob storage',
      'Server → Code fixes. Instead of trusting the client\'s "chunk done", ask storage which parts it really has.'),
    {
      id: 'clean-files',
      icon: '🧾',
      info: 'verifyUploads',
      label: 'Store 5,000 files with none broken',
      hint: 'Counts new files only while every upload is verified and none fail.',
      progress: gs => ({ value: Math.round(gs.liveStats.verifiedFiles || 0), target: 5000, unit: 'files' })
    },
    usersChallenge(1200, 'Keep headroom: verified uploads mean a little more work for blob storage.'),
    profitChallenge(2300, 'Broken files fail on download: lost revenue and refunds.')
  ],

  6: [
    fixOwned('dedup', '🧬', 'dedup', 'Skip storing files you already have (dedup)',
      'Server → Code fixes → Fingerprints and dedup. Same fingerprint = already stored = skip it.'),
    filesStored(20000, 'New files pour in. Dedup stores copies once; blob storage\'s disk may also need to grow.'),
    usersChallenge(1500, 'Uploads doubled: check blob storage\'s network.'),
    incidentChallenge('spike'),
    profitChallenge(2500, 'Storage is your biggest bill: every GB you don\'t store is money saved. Try the compression switch too.')
  ],

  7: [
    placedChallenge('cache', '⚡', 'Put a cache in front of the database', 'Server → Cache tab. Share lists people open again and again come from memory.'),
    fixOwned('sharesTable', '🤝', 'sharesTable', 'Keep shares in their own table',
      'Server → Code fixes → Shares table. "Shared with me" becomes one lookup instead of scanning every file.'),
    usersChallenge(2000, 'Teams list their shares all day. Without the shares table, database CPU grows with every file.'),
    latencyChallenge(60, 2000, 'Keep every machine under ~70% busy.'),
    profitChallenge(4000, 'A small cache is cheaper than a huge database.')
  ],

  8: [
    placedChallenge('sync', '🔄', 'Push changes with a sync server', 'Server → Sync tab. Devices keep one live connection and hear about changes instantly, instead of polling.'),
    whileBusy('sync-fast', '⏱️', 'syncServer', 'Changes reach other devices within 1 second at 3,000+ users',
      'Polling every 5 seconds means up to 5 seconds of delay (and huge load). Push is instant.',
      3000, st => st.syncDelaySec <= 1 && st.errorRate < 0.05, st => `${st.syncDelaySec} s delay`),
    fixOwned('deltaSync', '✂️', 'deltaSync', 'Upload only the changed chunks (delta sync)',
      'Server → Code fixes → Delta sync. Half of uploads are edits of existing files: send only what changed.'),
    usersChallenge(3000, 'Each open connection uses the sync server\'s RAM, even when nothing changes.'),
    profitChallenge(7000, 'Polls cost CPU on your app and database; idle connections cost only RAM.')
  ],

  9: [
    fixOwned('versions', '🗂️', 'versions', 'Keep versions and conflicted copies',
      'Server → Code fixes. When two edits clash, keep both instead of overwriting.'),
    {
      id: 'safe-edits',
      icon: '🛟',
      info: 'versions',
      label: 'Save 5,000 edits with none lost',
      hint: 'Counts edits only while clashes are kept as conflicted copies. Versions use more storage: watch the blob disk.',
      progress: gs => ({ value: Math.round(gs.liveStats.safeEdits || 0), target: 5000, unit: 'edits' })
    },
    usersChallenge(3500, 'Versions mean ~30% more writes and storage.'),
    profitChallenge(7500, 'Lost work costs trust; extra storage costs money. Balance them.')
  ],

  10: [
    fixOwned('coldTier', '🧊', 'coldTier', 'Move old files to a cold storage tier',
      'Server → Code fixes → Cold storage tier. Blob storage costs half as much to run.'),
    {
      id: 'shards',
      icon: '🧱',
      info: 'sharding',
      label: 'Split metadata across 3 database shards',
      hint: 'Server → Database tab → Add shard. Each shard holds a slice of users\' metadata.',
      progress: gs => ({ value: gs.dbCount(), target: 3, unit: 'shards' })
    },
    {
      id: 'db-cpu',
      icon: '🗄️',
      info: 'sharding',
      label: 'Database CPU under 65% with 5,000+ users',
      hint: 'Metadata queries far outnumber file transfers. Shards split them.',
      progress: gs => {
        const cpu = cpuAtUsers(gs, 'db', 5000);
        const ok = gs.users >= 5000 && cpu < 0.65;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `DB CPU ${Math.round(cpu * 100)}% at 5,000 users` };
      }
    },
    usersChallenge(5000, 'Lists, polls and uploads all hit metadata.'),
    profitChallenge(17000, 'Cold storage halves your biggest bill.')
  ],

  11: [
    placedChallenge('cdn', '🌍', 'Serve public files from a CDN', 'Server → CDN tab. Popular public files come from an edge near each user.'),
    latencyChallenge(75, 6000, 'Half of users are far away. The CDN helps public downloads; private files still come from your region.'),
    usersChallenge(6000, 'With the edge serving popular files, blob storage\'s network breathes again.'),
    incidentChallenge('spike'),
    profitChallenge(19000, 'A CDN costs money too: it pays off only for files downloaded many times.')
  ]
};
