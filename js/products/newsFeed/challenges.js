/**
 * News feed — the goals each level must meet (see js/game/Challenges.js
 * for how they are evaluated and latched).
 */

import {
  placedChallenge, usersChallenge, latencyChallenge, incidentChallenge, profitChallenge, cpuAtUsers
} from '../../game/Challenges.js';

function postsStored(target, hint, info = 'diskSpace') {
  return {
    id: 'posts',
    icon: '📝',
    info,
    label: `Store ${target.toLocaleString()} posts`,
    hint,
    progress: gs => ({ value: gs.guestbook.count, target, unit: 'posts' })
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

function feedWrites(target, hint) {
  return {
    id: 'feed-writes',
    icon: '📣',
    info: 'fanout',
    label: `Deliver ${target.toLocaleString()} posts into followers' feeds`,
    hint,
    progress: gs => ({ value: Math.round(gs.liveStats.feedWrites || 0), target, unit: 'feed writes' })
  };
}

export const NEWS_FEED_CHALLENGES = {
  1: [
    placedChallenge('app', '🖥️', 'Build and place your server', 'Open Server, pick parts, buy and place it.'),
    usersChallenge(100, 'Users stop growing at your server\'s limit. Open Server and upgrade the part marked "runs out first".'),
    postsStored(300, 'Users post over time. More users = more posts.', 'storage'),
    latencyChallenge(60, 100, 'Each feed load reads every post, so it gets slower as posts pile up. Keep every part under ~70% busy.'),
    incidentChallenge('spike', {
      hint: 'A spike adds 20–40% more traffic for 20 seconds. Build room for ~150 users: in Server, "Can handle" should say 150+.'
    })
  ],

  2: [
    placedChallenge('db', '🗄️', 'Move the posts to their own database server', 'Open Server → Database tab, buy a database server and place it.'),
    postsStored(3000, 'Posts pile up. When the disk is full every new post fails.'),
    latencyChallenge(80, 400, 'Without pagination every feed returns every post; without the index the database scans them all. Server → Code fixes.'),
    profitChallenge(1500, 'Two servers means two running bills. Code fixes are a one-time cost and make every request cheaper.')
  ],

  3: [
    placedChallenge('gateway', '🚦', 'Put an API gateway in front of your API', 'Open Server → Gateway tab and place it. Rate limiting rejects accounts that post too much.'),
    {
      id: 'spam-blocked',
      icon: '🛑',
      info: 'rateLimiting',
      label: 'Block 20,000 spam posts',
      hint: 'Once the gateway is in place it rejects ~95% of spam posts with "429 Too Many Requests".',
      progress: gs => ({ value: Math.round(gs.liveStats.botsBlocked || 0), target: 20000, unit: 'blocked' })
    },
    {
      id: 'clean-errors',
      icon: '✅',
      info: 'uptime',
      label: 'Under 1% failed requests with 550+ users',
      hint: 'If errors stay high, check the disk (spam fills it) and which machine runs out first.',
      progress: gs => {
        const err = gs.metrics?.errorRate ?? 1;
        const ok = gs.users >= 550 && err < 0.01;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(err * 100).toFixed(1)}% failing at ${gs.users} users` };
      }
    },
    incidentChallenge('bots', {
      label: 'Survive a spam attack (under 5% failed requests)',
      hint: 'During an attack spam triples or quadruples. With a rate-limiting gateway it barely matters.'
    })
  ],

  4: [
    placedChallenge('lb', '⚖️', 'Add a load balancer', 'Open Server → LB tab and place it. Then the App tab lets you add more app servers.'),
    {
      id: 'three-apps',
      icon: '🖥️',
      info: 'horizontalScaling',
      label: 'Run 3 app servers',
      hint: 'Server → App tab → "Add app server". Any server can build any feed, so with 3, one can crash and two cope.',
      progress: gs => ({ value: gs.appCount(), target: 3, unit: 'servers' })
    },
    usersChallenge(1500, 'Add app servers instead of buying bigger ones. "Keep the newest feed window" (Code fixes) stops the posts table growing.'),
    incidentChallenge('crash')
  ],

  5: [
    placedChallenge('cache', '⚡', 'Add a feed cache', 'Open Server → Cache tab and place it. Each user\'s feed is kept as a list of post IDs.'),
    {
      id: 'hit-rate',
      icon: '🎯',
      info: 'cache',
      label: 'Cache hit rate 90% or more',
      hint: 'Active users\' feeds live in the cache, so almost every scroll is answered from memory.',
      progress: gs => {
        const hit = gs.serverStatus?.cacheHit ?? 0;
        return { value: hit >= 0.9 ? 1 : 0, target: 1, unit: '', display: `Hit rate ${Math.round(hit * 100)}%` };
      }
    },
    {
      id: 'db-cpu',
      icon: '🗄️',
      info: 'cache',
      label: 'Database CPU under 50% with 2,000+ users',
      hint: 'With the feed cache the database only sees misses and new posts.',
      progress: gs => {
        const cpu = cpuAtUsers(gs, 'db', 2000);
        const ok = gs.users >= 2000 && cpu < 0.5;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `DB CPU ${Math.round(cpu * 100)}% at 2,000 users` };
      }
    },
    latencyChallenge(45, 2000, 'A feed from memory is fast. Keep every machine under ~70% busy.'),
    incidentChallenge('spike')
  ],

  6: [
    placedChallenge('queue', '📨', 'Fan out posts through a message queue', 'Open Server → Queue tab and place it. Posting drops a job in the queue; workers fill followers\' feeds.'),
    feedWrites(150000, 'Every post is written into ~200 followers\' feeds. The counter grows as long as posts succeed.'),
    latencyChallenge(60, 2500, 'Inline fan-out makes every post wait for ~200 feed writes. Through the queue, posting returns at once.'),
    usersChallenge(2500, 'Fan-out moves work from the app servers to the queue. Check what runs out first.'),
    profitChallenge(12000, 'Inline fan-out needs a server per few hundred users; workers behind a queue are far cheaper.')
  ],

  7: [
    fixOwned('hybridFanout', '🌟', 'hybridFanout', 'Switch to hybrid fan-out',
      'Server → Code fixes → Hybrid fan-out: celebrity posts are pulled in when a feed is read instead of pushed into millions of feeds.'),
    {
      id: 'backlog',
      icon: '📭',
      info: 'fanout',
      label: 'Fan-out queue keeps up for 60 seconds (2,500+ users)',
      hint: 'Celebrity posts need ~1,000× the feed writes; the queue falls behind and feeds go stale. A bigger queue only buys time.',
      progress: gs => {
        const sec = gs.users >= 2500 ? Math.floor(gs.liveStats.fanoutClearSec || 0) : 0;
        const backlog = Math.round(gs.liveStats.fanoutBacklog || 0);
        return { value: Math.min(60, sec), target: 60, unit: 's', display: backlog ? `${backlog.toLocaleString()} feed writes behind` : `${Math.min(60, sec)} s with no backlog` };
      }
    },
    latencyChallenge(50, 3000, 'Merging celebrity posts adds a few ms to each read. Keep every machine under ~70% busy.'),
    incidentChallenge('spike')
  ],

  8: [
    {
      id: 'shards',
      icon: '🧱',
      info: 'sharding',
      label: 'Split the posts across 3 database shards',
      hint: 'Server → Database tab → "Add shard". Each shard holds a slice of the posts.',
      progress: gs => ({ value: gs.dbCount(), target: 3, unit: 'shards' })
    },
    placedChallenge('idgen', '🔢', 'Add a global ID generator', 'Each shard counts its own IDs, so two posts can share an ID and the feed order breaks. Open Server → IDs tab.'),
    {
      id: 'clean-posts',
      icon: '🧬',
      info: 'idGenerator',
      label: 'Store 10,000 posts on 2+ shards',
      hint: 'Counts new posts while you run 2+ shards and the database is healthy.',
      progress: gs => ({ value: Math.round(gs.liveStats.cleanLinks || 0), target: 10000, unit: 'posts' })
    },
    usersChallenge(3500, 'Posts pour in. Shards add disk space and write capacity.')
  ],

  9: [
    placedChallenge('cdn', '🌍', 'Serve photos from a CDN', 'Open Server → CDN tab and place it. Photos are served from a city near each user.'),
    latencyChallenge(80, 5000, '60% of users are far away and pay ~120 ms. Only the edge brings that down.'),
    usersChallenge(5000, 'With the edge serving photos, your origin sees far less. Check what still runs out first.'),
    profitChallenge(12000, 'The edge takes most of the bytes, so origin servers can be smaller.')
  ]
};
