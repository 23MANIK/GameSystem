/**
 * Challenges — the goals a level must meet before it is complete.
 *
 * Each challenge reads the game state and returns { value, target, met }.
 * Once a challenge is met it stays done (stored in gameState.challengesDone),
 * so a dip afterwards doesn't take it away.
 */

import { ROLES } from '../data/roles.js';

export const GUESTBOOK_CHALLENGES = {
  1: [
    {
      id: 'users',
      icon: '👥',
      info: 'userLimit',
      label: 'Reach 100 users online',
      hint: 'Users stop growing at your server\'s limit. Open Server and upgrade the part marked "runs out first".',
      progress: gs => ({ value: gs.users, target: 100, unit: 'users' })
    },
    {
      id: 'storage',
      icon: '💾',
      info: 'storage',
      label: 'Store 60 Guestbook entries',
      hint: 'Visitors sign over time, roughly 1 entry per 250 user-seconds. More users = faster.',
      progress: gs => ({ value: gs.guestbook.count, target: 60, unit: 'entries' })
    },
    {
      id: 'latency',
      icon: '⚡',
      info: 'latency',
      label: 'Latency under 60 ms with 100+ users online',
      hint: 'Latency climbs once any part is over ~70% busy. Upgrade so 100 users use less than 80% of every part.',
      progress: gs => {
        const ok = gs.users >= 100 && (gs.metrics?.latency || 999) < 60;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${gs.metrics?.latency || 0} ms at ${gs.users} users` };
      }
    },
    {
      id: 'spike',
      icon: '📈',
      info: 'spike',
      label: 'Survive a traffic spike (under 5% failed requests)',
      hint: 'About 130 people in your town use the Guestbook, and a spike adds 20–40% more traffic for 20 seconds. Build room for ~180 users: in Server, "Can handle" should say 180+.',
      progress: gs => ({ value: gs.achievements.spikeHandled ? 1 : 0, target: 1, unit: '', display: gs.spike ? `Spike now: ×${gs.spike.mult}` : 'Waiting for a spike' })
    },
    {
      id: 'profit',
      icon: '💰',
      info: 'profit',
      label: 'Earn 1,000 coins profit',
      hint: 'Profit = revenue − server running cost − outage penalties. Failed requests earn nothing and cost refunds, so fix overloads fast. Bigger parts cost more every minute, so only buy what you need.',
      progress: gs => ({ value: Math.max(0, gs.getEconomySummary().profit), target: 1000, unit: 'coins' })
    }
  ],

  2: [
    {
      id: 'database',
      icon: '🗄️',
      info: 'database',
      label: 'Move the data to its own database server',
      hint: 'Open Server → Database tab, buy a database server and place it on the map next to your app server.',
      progress: gs => ({ value: gs.isDbPlaced() ? 1 : 0, target: 1, unit: '', display: gs.isDbPlaced() ? 'Done' : 'No database yet' })
    },
    {
      id: 'users',
      icon: '👥',
      info: 'userLimit',
      label: 'Reach 400 users online',
      hint: 'Two machines now: check which one (App or DB) has the part that runs out first. The Server Builder shows it in "Runs out first".',
      progress: gs => ({ value: gs.users, target: 400, unit: 'users' })
    },
    {
      id: 'storage',
      icon: '💽',
      info: 'diskSpace',
      label: 'Store 2,000 Guestbook entries',
      hint: 'Entries pile up fast now. When the disk is full every signature fails. SSDs are fast but small; NVMe holds more; HDDs are big but slow.',
      progress: gs => ({ value: gs.guestbook.count, target: 2000, unit: 'entries' })
    },
    {
      id: 'latency',
      icon: '⚡',
      info: 'index',
      label: 'Latency under 80 ms with 400+ users online',
      hint: 'Without an index the database scans every row on each read, and that gets slower as the book grows. Buy the Database index (Server → Code fixes) and keep every part under ~75%.',
      progress: gs => {
        const ok = gs.users >= 400 && (gs.metrics?.latency || 999) < 80;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${gs.metrics?.latency || 0} ms at ${gs.users} users` };
      }
    },
    {
      id: 'spike',
      icon: '📈',
      info: 'spike',
      label: 'Survive a traffic spike (under 5% failed requests)',
      hint: 'Spikes push 1.5–2× the traffic for 20 seconds. Leave headroom on BOTH servers.',
      progress: gs => ({ value: gs.achievements.spikeHandled ? 1 : 0, target: 1, unit: '', display: gs.spike ? `Spike now: ×${gs.spike.mult}` : 'Waiting for a spike' })
    },
    {
      id: 'profit',
      icon: '💰',
      info: 'profit',
      label: 'Earn 2,000 coins profit this level',
      hint: 'Two servers means two running bills. Code fixes are a one-time cost and make every request cheaper: often better value than bigger machines.',
      progress: gs => ({ value: Math.max(0, gs.getEconomySummary().profit), target: 2000, unit: 'coins' })
    }
  ],

  3: [
    placedChallenge('web', '🌐', 'Serve the UI from its own web server', 'Open Server → Web tab, buy a web server and place it. Pages (HTML, JavaScript, images) then skip the app server entirely.'),
    usersChallenge(600, 'The app server is busy shipping 300 KB pages. Move them to the web server, then upgrade whichever machine "runs out first".'),
    {
      id: 'app-cpu',
      icon: '🧠',
      info: 'webServer',
      label: 'App server CPU under 80% with 600+ users',
      hint: 'Building and sending pages is expensive. Once the web server serves them, the app server only answers small JSON API calls.',
      progress: gs => {
        // CPU it would need at exactly 600 users (users keep growing past the target)
        const cpu = cpuAtUsers(gs, 'app', 600);
        const ok = gs.users >= 600 && cpu < 0.8;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `App CPU ${Math.round(cpu * 100)}% at 600 users` };
      }
    },
    latencyChallenge(80, 600, 'Latency jumps when any machine is past ~70%. Leave headroom on the app server, web server and database.'),
    incidentChallenge('spike'),
    profitChallenge(2000, 'Two machines became three. Make sure each one earns its running cost: don\'t max out parts you don\'t need.')
  ],

  4: [
    placedChallenge('gateway', '🚦', 'Put an API gateway in front of your API', 'Open Server → Gateway tab and place it. Every API request goes through it first, and rate limiting rejects clients that call too often.'),
    {
      id: 'bots-blocked',
      icon: '🛑',
      info: 'rateLimiting',
      label: 'Block 20,000 bot requests',
      hint: 'Once the gateway is in place, it rejects ~95% of bot calls with "429 Too Many Requests". The counter goes up by itself.',
      progress: gs => ({ value: Math.round(gs.liveStats.botsBlocked || 0), target: 20000, unit: 'blocked' })
    },
    usersChallenge(600, 'Bots eat CPU and bandwidth that real users need. Block them first, then grow.'),
    {
      id: 'clean-errors',
      icon: '🛡️',
      info: 'uptime',
      label: 'Under 1% failed requests with 600+ users',
      hint: 'Real users should barely notice the bots. If errors stay high, check which machine runs out first.',
      progress: gs => {
        const err = gs.metrics?.errorRate ?? 1;
        const ok = gs.users >= 600 && err < 0.01;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(err * 100).toFixed(1)}% failing at ${gs.users} users` };
      }
    },
    incidentChallenge('bots'),
    profitChallenge(2500, 'Bots never pay. Every request they make that reaches your servers is pure cost.')
  ],

  5: [
    placedChallenge('lb', '⚖️', 'Add a load balancer', 'Open Server → LB tab and place it. Then the App tab lets you add more app servers behind it.'),
    {
      id: 'three-apps',
      icon: '🖥️',
      info: 'horizontalScaling',
      label: 'Run 3 app servers',
      hint: 'Server → App tab → "Add app server". Each one takes a share of the requests. With 3, one can crash and the other 2 cope.',
      progress: gs => ({ value: gs.appCount(), target: 3, unit: 'servers' })
    },
    usersChallenge(1500, 'Even the biggest app server tops out well below 1,500 users. Add servers instead of buying bigger ones. The database may need its XL parts.'),
    incidentChallenge('crash'),
    profitChallenge(7000, 'More servers means more running cost. Medium-sized servers in a group are often cheaper than maxed-out ones.')
  ],

  6: [
    placedChallenge('cache', '⚡', 'Put a cache in front of the database', 'Open Server → Cache tab and place it. Reads check the cache first; only misses reach the database.'),
    {
      id: 'hit-rate',
      icon: '🎯',
      info: 'cache',
      label: 'Cache hit rate 90% or more',
      hint: 'Without pagination every "read all" is a different, huge answer that caches poorly. With pagination, the same first page is read over and over: perfect for a cache.',
      progress: gs => {
        const hit = gs.serverStatus?.cacheHit ?? 0;
        return { value: hit >= 0.9 ? 1 : 0, target: 1, unit: '', display: `Hit rate ${Math.round(hit * 100)}%` };
      }
    },
    usersChallenge(2500, 'App servers scale out, but there is one database. Let the cache take the reads.'),
    {
      id: 'db-cpu',
      icon: '🗄️',
      info: 'cache',
      label: 'Database CPU under 50% with 2,500+ users',
      hint: 'With a 90%+ hit rate the database only sees 1 in 10 reads, plus writes.',
      progress: gs => {
        const cpu = cpuAtUsers(gs, 'db', 2500);
        const ok = gs.users >= 2500 && cpu < 0.5;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `DB CPU ${Math.round(cpu * 100)}% at 2,500 users` };
      }
    },
    latencyChallenge(50, 2500, 'Answers from memory are fast. Keep every machine under ~70% busy.'),
    profitChallenge(13000, 'A cache is cheap compared to a bigger database. Spend where it helps the most.')
  ],

  7: [
    placedChallenge('cdn', '🌍', 'Add a CDN', 'Open Server → CDN tab and place it. Pages and popular reads get served from a location near each user.'),
    usersChallenge(3500, 'With a CDN most traffic never reaches your servers. Check what still runs out first.'),
    latencyChallenge(80, 3500, '60% of users are on other continents and pay ~120 ms each way. Only a CDN (with pagination, so pages cache well) brings that down.'),
    incidentChallenge('spike'),
    profitChallenge(8000, 'The CDN answers most requests at the edge, so your origin servers can be smaller. Fewer, smaller machines = lower running cost.')
  ]
};

// ─── Challenge builders shared by several levels ───

export function placedChallenge(role, icon, label, hint) {
  return {
    id: `place-${role}`,
    icon,
    info: { db: 'database', web: 'webServer', gateway: 'gateway', lb: 'loadBalancer', cache: 'cache', cdn: 'cdn', idgen: 'idGenerator', queue: 'messageQueue', blob: 'blobStorage', sync: 'syncServer' }[role] ?? ROLES[role]?.info,
    label,
    hint,
    progress: gs => ({ value: gs.isPlaced(role) ? 1 : 0, target: 1, unit: '', display: gs.isPlaced(role) ? 'Done' : 'Not built yet' })
  };
}

export function usersChallenge(target, hint) {
  return {
    id: 'users',
    icon: '👥',
    info: 'userLimit',
    label: `Reach ${target.toLocaleString()} users online`,
    hint,
    progress: gs => ({ value: gs.users, target, unit: 'users' })
  };
}

export function latencyChallenge(ms, users, hint) {
  return {
    id: 'latency',
    icon: '⚡',
    info: 'latency',
    label: `Latency under ${ms} ms with ${users.toLocaleString()}+ users online`,
    hint,
    progress: gs => {
      const ok = gs.users >= users && (gs.metrics?.latency || 999) < ms;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${gs.metrics?.latency || 0} ms at ${gs.users.toLocaleString()} users` };
    }
  };
}

export function incidentChallenge(kind, override = {}) {
  const text = {
    spike: ['📈', 'spike', 'Survive a traffic spike (under 5% failed requests)', 'Spikes push 1.5–2× the traffic for 20 seconds. Keep headroom on every machine.', 'spikeHandled', 'Waiting for a spike'],
    bots: ['🤖', 'rateLimiting', 'Survive a bot attack (under 5% failed requests)', 'During an attack, bot traffic triples or quadruples. With a rate-limiting gateway it barely matters; without one, your servers drown.', 'botsHandled', 'Waiting for a bot attack'],
    crash: ['💥', 'horizontalScaling', 'Survive an app server crash (under 5% failed requests)', 'When one app server dies, the load balancer sends its users to the others. They need enough spare room to take the extra load.', 'crashHandled', 'Waiting for a crash']
  }[kind];
  const [icon, info, label, hint, key, waiting] = text;
  return buildIncident(kind, override.icon || icon, override.info || info, override.label || label, override.hint || hint, key, waiting);
}

function buildIncident(kind, icon, info, label, hint, key, waiting) {
  return {
    id: `survive-${kind}`,
    icon,
    info,
    label,
    hint,
    progress: gs => ({
      value: gs.achievements[key] ? 1 : 0,
      target: 1,
      unit: '',
      display: gs.spike?.kind === kind ? 'Happening now!' : waiting
    })
  };
}

export function profitChallenge(target, hint) {
  return {
    id: 'profit',
    icon: '💰',
    info: 'profit',
    label: `Earn ${target.toLocaleString()} coins profit this level`,
    hint,
    progress: gs => ({ value: Math.max(0, gs.getEconomySummary().profit), target, unit: 'coins' })
  };
}

/** Challenges of the product being played (swapped by js/products/registry.js). */
let LEVEL_CHALLENGES = GUESTBOOK_CHALLENGES;

export function setChallenges(table) {
  LEVEL_CHALLENGES = table;
}

export function getChallenges(level) {
  return LEVEL_CHALLENGES[level] || [];
}

/**
 * Evaluate every challenge of the current level. Newly met ones are latched
 * into gs.challengesDone and returned in `newlyDone`.
 */
export function evaluateChallenges(gs) {
  const list = getChallenges(gs.level);
  const newlyDone = [];
  const results = list.map(ch => {
    const p = ch.progress(gs);
    const wasDone = gs.challengesDone.includes(ch.id);
    const metNow = p.value >= p.target;
    if (metNow && !wasDone) {
      gs.challengesDone.push(ch.id);
      newlyDone.push(ch);
    }
    return { ...ch, ...p, done: wasDone || metNow };
  });
  const allDone = results.length > 0 && results.every(r => r.done);
  return { results, newlyDone, allDone, doneCount: results.filter(r => r.done).length };
}

/** A machine's CPU use scaled to a given number of users (load grows in step with users). */
export function cpuAtUsers(gs, role, users) {
  const cpu = gs.serverStatus?.servers?.[role]?.usage?.cpu;
  if (cpu == null || !gs.users) return 1;
  return cpu * users / gs.users;
}
