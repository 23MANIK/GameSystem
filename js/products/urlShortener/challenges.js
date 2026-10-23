/**
 * URL shortener — the goals each level must meet (see js/game/Challenges.js
 * for how they are evaluated and latched).
 */

import {
  placedChallenge, usersChallenge, latencyChallenge, incidentChallenge, profitChallenge, cpuAtUsers
} from '../../game/Challenges.js';

function linksStored(target, hint, info = 'diskSpace') {
  return {
    id: 'links',
    icon: '🔗',
    info,
    label: `Store ${target.toLocaleString()} short links`,
    hint,
    progress: gs => ({ value: gs.guestbook.count, target, unit: 'links' })
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

export const URL_SHORTENER_CHALLENGES = {
  1: [
    usersChallenge(100, 'Users stop growing at your server\'s limit. Open Server and upgrade the part marked "runs out first".'),
    linksStored(300, 'Users create links over time (about 1 per 100 user-seconds). More users = more links.', 'storage'),
    {
      id: 'latency',
      icon: '⚡',
      info: 'latency',
      label: 'Redirects under 60 ms with 100+ users online',
      hint: 'Latency climbs once any part is over ~70% busy. Upgrade so 100 users use less than 80% of every part.',
      progress: gs => {
        const ok = gs.users >= 100 && (gs.metrics?.latency || 999) < 60;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${gs.metrics?.latency || 0} ms at ${gs.users} users` };
      }
    },
    incidentChallenge('spike', {
      hint: 'About 130 people use your shortener, and a spike adds 20–40% more clicks for 20 seconds. Build room for ~180 users: in Server, "Can handle" should say 180+.'
    }),
    profitChallenge(1000, 'Profit = revenue − server running cost − outage penalties. Failed redirects earn nothing, so fix overloads fast. Bigger parts cost more every minute.')
  ],

  2: [
    placedChallenge('db', '🗄️', 'Move the links to their own database server', 'Open Server → Database tab, buy a database server and place it next to your app server.'),
    fixOwned('base62', '🔤', 'base62', 'Make short codes from unique IDs (Base62)',
      'Right now each new code is a hash of the long URL, so the app must ask the database "is this code taken?" before saving. Server → Code fixes → Base62 makes the code from the row\'s ID: unique by design, no check needed.'),
    usersChallenge(400, 'Two machines now: check which one (App or DB) "runs out first" in the Server Builder.'),
    linksStored(3000, 'Links pile up fast now. When the disk is full every new link fails. SSDs are fast but small; NVMe holds more; HDDs are big but slow.'),
    latencyChallenge(80, 400, 'Without an index the database reads every row to find one code, and that gets slower with every link. Buy the Primary-key index (Server → Code fixes) and keep every part under ~75%.'),
    profitChallenge(1500, 'Two servers means two running bills. Code fixes are a one-time cost and make every request cheaper.')
  ],

  3: [
    placedChallenge('gateway', '🚦', 'Put an API gateway in front of your API', 'Open Server → Gateway tab and place it. Every API call passes through it, and rate limiting rejects clients that create too many links.'),
    {
      id: 'spam-blocked',
      icon: '🛑',
      info: 'rateLimiting',
      label: 'Block 20,000 spam requests',
      hint: 'Once the gateway is in place it rejects ~95% of spam calls with "429 Too Many Requests". The counter goes up by itself.',
      progress: gs => ({ value: Math.round(gs.liveStats.botsBlocked || 0), target: 20000, unit: 'blocked' })
    },
    usersChallenge(600, 'Spam eats database writes and disk space that real users need. Block it first, then grow.'),
    {
      id: 'clean-errors',
      icon: '✅',
      info: 'uptime',
      label: 'Under 1% failed requests with 600+ users',
      hint: 'If errors stay high, check the disk (spam fills it) and which machine runs out first.',
      progress: gs => {
        const err = gs.metrics?.errorRate ?? 1;
        const ok = gs.users >= 600 && err < 0.01;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(err * 100).toFixed(1)}% failing at ${gs.users} users` };
      }
    },
    incidentChallenge('bots', {
      label: 'Survive a spam attack (under 5% failed requests)',
      hint: 'During an attack spam traffic triples or quadruples. With a rate-limiting gateway it barely matters; without one, your database drowns in writes.'
    }),
    profitChallenge(2000, 'Spam never pays. Every spam link that reaches your database costs a write and disk space.')
  ],

  4: [
    placedChallenge('lb', '⚖️', 'Add a load balancer', 'Open Server → LB tab and place it. Then the App tab lets you add more app servers behind it.'),
    {
      id: 'three-apps',
      icon: '🖥️',
      info: 'horizontalScaling',
      label: 'Run 3 app servers',
      hint: 'Server → App tab → "Add app server". Redirects carry no session, so any server can answer any click. With 3, one can crash and two cope.',
      progress: gs => ({ value: gs.appCount(), target: 3, unit: 'servers' })
    },
    usersChallenge(1500, 'Add app servers instead of buying bigger ones. The database may need its XL parts.'),
    incidentChallenge('crash'),
    profitChallenge(5000, 'More servers means more running cost. Medium servers in a group are often cheaper than maxed-out ones.')
  ],

  5: [
    placedChallenge('cache', '⚡', 'Put a cache in front of the database', 'Open Server → Cache tab and place it. Redirects check the cache first; only misses reach the database.'),
    {
      id: 'hit-rate',
      icon: '🎯',
      info: 'cache',
      label: 'Cache hit rate 90% or more',
      hint: 'A few viral links get most clicks, so a cache that holds just the hot links answers almost every redirect.',
      progress: gs => {
        const hit = gs.serverStatus?.cacheHit ?? 0;
        return { value: hit >= 0.9 ? 1 : 0, target: 1, unit: '', display: `Hit rate ${Math.round(hit * 100)}%` };
      }
    },
    usersChallenge(2500, 'App servers scale out, but there is one database. Let the cache take the clicks.'),
    {
      id: 'db-cpu',
      icon: '🗄️',
      info: 'cache',
      label: 'Database CPU under 50% with 2,500+ users',
      hint: 'With a 90%+ hit rate the database only sees 1 click in 10, plus new links.',
      progress: gs => {
        const cpu = cpuAtUsers(gs, 'db', 2500);
        const ok = gs.users >= 2500 && cpu < 0.5;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `DB CPU ${Math.round(cpu * 100)}% at 2,500 users` };
      }
    },
    latencyChallenge(45, 2500, 'Answers from memory are fast. Keep every machine under ~70% busy.'),
    profitChallenge(8000, 'A cache is cheap compared to a bigger database. Spend where it helps the most.')
  ],

  6: [
    placedChallenge('queue', '📨', 'Send click events through a message queue', 'Open Server → Queue tab and place it. Redirects drop an event in the queue and answer at once; a worker counts clicks in batches.'),
    {
      id: 'clicks',
      icon: '📊',
      info: 'clickAnalytics',
      label: 'Count 50,000 clicks',
      hint: 'Clicks are counted as long as redirects succeed. Failed redirects are clicks you never see.',
      progress: gs => ({ value: Math.round(gs.liveStats.clicksCounted || 0), target: 50000, unit: 'clicks' })
    },
    usersChallenge(3000, 'Counting each click inline is a database write per redirect. The queue turns 50 clicks into one write.'),
    latencyChallenge(45, 3000, 'An inline click write makes every redirect wait for the database. Through the queue, redirects return straight away.'),
    incidentChallenge('spike'),
    profitChallenge(12000, 'Customers pay for analytics, but only if counting clicks doesn\'t cost more than it earns.')
  ],

  7: [
    {
      id: 'shards',
      icon: '🧱',
      info: 'sharding',
      label: 'Split the links across 3 database shards',
      hint: 'Server → Database tab → "Add shard". Each shard holds a slice of the links (by short code), so you get 3 disks and 3 CPUs.',
      progress: gs => ({ value: gs.dbCount(), target: 3, unit: 'shards' })
    },
    placedChallenge('idgen', '🔢', 'Add a global ID generator', 'Each shard counts its own IDs, so two shards can hand out the same code. Open Server → IDs tab: one counter for everyone.'),
    {
      id: 'clean-links',
      icon: '🧬',
      info: 'idGenerator',
      label: 'Create 10,000 links on 2+ shards with no clashing codes',
      hint: 'Counts new links only while you run 2+ shards and no two can get the same code: that needs the ID generator (or hashing with a check on every shard, which is slow).',
      progress: gs => ({ value: Math.round(gs.liveStats.cleanLinks || 0), target: 10000, unit: 'links' })
    },
    usersChallenge(3500, 'New links pour in. Watch the disk: shards add space, and "Expire old links" keeps tables from growing forever.'),
    profitChallenge(15000, 'Every shard is another running bill. Expiring old links can save you a shard.')
  ],

  8: [
    placedChallenge('cdn', '🌍', 'Redirect at the edge with a CDN', 'Open Server → CDN tab and place it. Popular redirects are answered in a city near each user.'),
    usersChallenge(5000, 'With the edge answering most clicks, your origin sees far less. Check what still runs out first.'),
    latencyChallenge(80, 5000, '60% of clicks come from far away and pay ~120 ms. Only answering at the edge brings that down.'),
    {
      id: 'accuracy',
      icon: '📊',
      info: 'redirect301',
      label: 'Click counts 95%+ accurate with 5,000+ users',
      hint: 'A 301 lets browsers skip you on repeat clicks: less load, but those clicks are never counted. Keep 302 (Code fixes) and keep failures low.',
      progress: gs => {
        const acc = gs.serverStatus?.clickAccuracy ?? 0;
        const ok = gs.users >= 5000 && acc >= 0.95;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${Math.round(acc * 100)}% of clicks counted at ${gs.users.toLocaleString()} users` };
      }
    },
    incidentChallenge('spike'),
    profitChallenge(12000, 'The edge answers most clicks, so origin servers can be smaller. Fewer, smaller machines = lower running cost.')
  ]
};
