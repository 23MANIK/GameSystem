/**
 * Ad click aggregator — the goals each level must meet (see js/game/Challenges.js).
 */

import {
  placedChallenge, usersChallenge, latencyChallenge, incidentChallenge, profitChallenge, cpuAtUsers
} from '../../game/Challenges.js';

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

function clicksCounted(target, hint) {
  return {
    id: 'clicks',
    icon: '🖱️',
    info: 'feature',
    label: `Count ${target.toLocaleString()} clicks`,
    hint,
    progress: gs => ({ value: Math.round(gs.liveStats.clicksCounted || 0), target, unit: 'clicks' })
  };
}

function accuracy(pct, users, info, hint) {
  return {
    id: 'accuracy',
    icon: '🎯',
    info,
    label: `Click counts ${pct}%+ accurate with ${users.toLocaleString()}+ users`,
    hint,
    progress: gs => {
      const acc = gs.serverStatus?.clickAccuracy ?? 0;
      const ok = gs.users >= users && acc >= pct / 100;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(acc * 100).toFixed(1)}% accurate at ${gs.users.toLocaleString()} users` };
    }
  };
}

function accurateClicks(target, hint) {
  return {
    id: 'accurate-clicks',
    icon: '🎯',
    info: 'reconcile',
    label: `Count ${target.toLocaleString()} clicks while counts are 99%+ accurate`,
    hint,
    progress: gs => ({ value: Math.round(gs.liveStats.accurateClicks || 0), target, unit: 'clicks' })
  };
}

function cpuUnder(role, pct, users, info, label, hint) {
  return {
    id: `${role}-cpu`,
    icon: role === 'queue' ? '📨' : '🗄️',
    info,
    label,
    hint,
    progress: gs => {
      const cpu = cpuAtUsers(gs, role, users);
      const ok = gs.users >= users && gs.isPlaced(role) && cpu < pct / 100;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${role === 'queue' ? 'Queue' : 'DB'} CPU ${Math.round(cpu * 100)}% at ${users.toLocaleString()} users` };
    }
  };
}

export const AD_CLICKS_CHALLENGES = {
  1: [
    placedChallenge('app', '🖥️', 'Build and place your server', 'Open Server, pick parts, buy and place it.'),
    usersChallenge(100, 'Users stop growing at your server\'s limit. Open Server and upgrade the part marked "runs out first".'),
    clicksCounted(3000, 'Every click that is logged and redirected counts. More users = more clicks.'),
    latencyChallenge(60, 100, 'The visitor waits while the click is written. Keep every part under ~70% busy.'),
    incidentChallenge('spike', {
      hint: 'A spike adds 20–40% more clicks for 20 seconds. Build room for ~150 users: in Server, "Can handle" should say 150+.'
    })
  ],

  2: [
    placedChallenge('db', '🗄️', 'Move ads and clicks to their own database server', 'Open Server → Database tab, buy a database server and place it.'),
    clicksCounted(30000, 'Each click is still a database write. Keep the database healthy.'),
    latencyChallenge(70, 400, 'Without an index each click scans every ad to find its URL. Server → Code fixes.'),
    profitChallenge(1500, 'Two servers means two running bills. Code fixes are a one-time cost and make every request cheaper.')
  ],

  3: [
    placedChallenge('queue', '📨', 'Send clicks through a message queue', 'Open Server → Queue tab and place it. Clicks are logged to the queue; a worker writes them in batches.'),
    clicksCounted(150000, 'Clicks are counted once they reach the queue and the batch writer.'),
    latencyChallenge(40, 900, 'Writing each click inline makes every redirect wait. Through the queue, the redirect returns at once.'),
    usersChallenge(900, 'The database now gets one write per 50 clicks. Check what runs out first.')
  ],

  4: [
    fixOwned('rollups', '🧮', 'rollups', 'Aggregate clicks as they stream',
      'Server → Code fixes → Stream aggregation. A stream processor keeps a count per ad per minute; dashboards read those counts.'),
    latencyChallenge(45, 1100, 'Each dashboard scanning raw clicks takes seconds. Pre-counted rows answer in milliseconds.'),
    cpuUnder('db', 60, 1100, 'rollups', 'Database CPU under 60% with 1,100+ users', 'GROUP BY over raw clicks is the database\'s heaviest job. Stream aggregation removes it.'),
    profitChallenge(4000, 'A smaller database is cheaper every minute.')
  ],

  5: [
    placedChallenge('cache', '⚡', 'Add a cache for impression IDs', 'Open Server → Cache tab and place it. It remembers which impression IDs were already counted.'),
    fixOwned('dedupIds', '🪪', 'dedupIds', 'Use signed impression IDs',
      'Server → Code fixes → Signed impression IDs. Each click carries its impression ID; repeats are dropped before counting.'),
    accuracy(99, 1200, 'dedupIds', 'About 8% of clicks are repeats. Only dedup by impression ID brings the count back to exact.'),
    usersChallenge(1200, 'The cache needs RAM for every recent impression ID. Check what runs out first.'),
    profitChallenge(3500, 'Advertisers only pay for real clicks. Exact counts keep them, and their budgets, with you.')
  ],

  6: [
    placedChallenge('lb', '⚖️', 'Add a load balancer', 'Open Server → LB tab and place it. Then the App tab lets you add more click processors.'),
    {
      id: 'three-apps',
      icon: '🖥️',
      info: 'horizontalScaling',
      label: 'Run 3 click processors',
      hint: 'Server → App tab → "Add app server". Any processor can take any click, so with 3, one can crash and two cope.',
      progress: gs => ({ value: gs.appCount(), target: 3, unit: 'servers' })
    },
    usersChallenge(2400, 'Add processors instead of buying bigger ones. Check what runs out first.'),
    incidentChallenge('crash')
  ],

  7: [
    fixOwned('saltKeys', '🧂', 'saltKeys', 'Split hot ads across partitions',
      'Server → Code fixes → Split hot ads. The viral ad\'s clicks get keys AdId:0…N and spread over the partitions.'),
    cpuUnder('queue', 70, 2800, 'saltKeys', 'Queue CPU under 70% with 2,800+ users', 'One partition is doing a third of all the work. A bigger queue only buys time; splitting the hot ad spreads it.'),
    usersChallenge(2800, 'With the queue balanced again, check what runs out first.'),
    incidentChallenge('spike', { label: 'Survive a viral moment (under 5% failed requests)' })
  ],

  8: [
    placedChallenge('blob', '🗄️', 'Keep raw clicks in a data lake', 'Open Server → Storage tab and place it. Every raw click is archived in big, cheap files.'),
    fixOwned('reconcile', '🧾', 'reconcile', 'Reconcile every night',
      'Server → Code fixes → Nightly reconciliation. A batch job recounts the raw clicks and corrects the live totals.'),
    accurateClicks(200000, 'Counts only while the numbers are 99%+ right: dedup on, nothing lost, no errors.'),
    usersChallenge(3200, 'The data lake takes a copy of every click. Check what runs out first.')
  ],

  9: [
    {
      id: 'shards',
      icon: '🧱',
      info: 'sharding',
      label: 'Split the counts across 3 database shards',
      hint: 'Server → Database tab → "Add shard". Each shard holds some advertisers\' counts.',
      progress: gs => ({ value: gs.dbCount(), target: 3, unit: 'shards' })
    },
    usersChallenge(4000, 'Count rows pour in. Shards add disk space and write capacity.'),
    accuracy(99, 4000, 'reconcile', 'Keep dedup and reconciliation working as you grow.'),
    profitChallenge(20000, 'Accurate bills at scale: keep every machine sized to what it needs.')
  ]
};
