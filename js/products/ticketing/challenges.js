/**
 * Ticket booking — the goals each level must meet (see js/game/Challenges.js).
 */

import {
  placedChallenge, usersChallenge, latencyChallenge, incidentChallenge, profitChallenge, cpuAtUsers
} from '../../game/Challenges.js';

function ticketsSold(target, hint, info = 'diskSpace') {
  return {
    id: 'tickets',
    icon: '🎟️',
    info,
    label: `Sell ${target.toLocaleString()} tickets`,
    hint,
    progress: gs => ({ value: gs.guestbook.count, target, unit: 'tickets' })
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

function safeBookings(target, hint) {
  return {
    id: 'safe-bookings',
    icon: '🎫',
    info: 'holds',
    label: `Make ${target.toLocaleString()} bookings with no seat sold twice`,
    hint,
    progress: gs => ({ value: Math.round(gs.liveStats.safeBookings || 0), target, unit: 'bookings' })
  };
}

function dbCpuUnder(pct, users, info, hint) {
  return {
    id: 'db-cpu',
    icon: '🗄️',
    info,
    label: `Database CPU under ${pct}% with ${users.toLocaleString()}+ users`,
    hint,
    progress: gs => {
      const cpu = cpuAtUsers(gs, 'db', users);
      const ok = gs.users >= users && cpu < pct / 100;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `DB CPU ${Math.round(cpu * 100)}% at ${users.toLocaleString()} users` };
    }
  };
}

function cleanRequests(users, hint) {
  return {
    id: 'clean-errors',
    icon: '🛡️',
    info: 'uptime',
    label: `Under 1% failed requests with ${users.toLocaleString()}+ users`,
    hint,
    progress: gs => {
      const err = gs.metrics?.errorRate ?? 1;
      const ok = gs.users >= users && err < 0.01;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(err * 100).toFixed(1)}% failing at ${gs.users.toLocaleString()} users` };
    }
  };
}

export const TICKETING_CHALLENGES = {
  1: [
    placedChallenge('app', '🖥️', 'Build and place your server', 'Open Server, pick parts, buy and place it.'),
    usersChallenge(100, 'Fans stop growing at your server\'s limit. Open Server and upgrade the part marked "runs out first".'),
    ticketsSold(300, 'Fans book seats over time. More fans = more tickets.', 'storage'),
    latencyChallenge(60, 100, 'Latency climbs once any part is over ~70% busy. Keep every part under ~70%.'),
    incidentChallenge('spike', {
      hint: 'A spike adds 20–40% more fans for 20 seconds. Build room for ~150: in Server, "Can handle" should say 150+.'
    })
  ],

  2: [
    placedChallenge('db', '🗄️', 'Move the tickets to their own database server', 'Open Server → Database tab, buy a database server and place it.'),
    ticketsSold(2500, 'Tickets pile up. When the disk is full every booking fails.'),
    latencyChallenge(70, 400, 'Without an index each seat map scans every ticket of every show. Server → Code fixes.'),
    profitChallenge(1500, 'Two servers means two running bills. Code fixes are a one-time cost and make every request cheaper.')
  ],

  3: [
    fixOwned('holds', '⏳', 'holds', 'Hold seats during checkout',
      'Server → Code fixes → Hold seats during checkout. A picked seat is reserved for 10 minutes, so nobody else can buy it.'),
    safeBookings(2000, 'Counts bookings while no seat can be sold twice. Hold seats first.'),
    cleanRequests(600, 'Every seat sold twice is a failed booking and a refund. Holds stop that; then check what runs out first.'),
    profitChallenge(2500, 'Refunds for double-sold seats cost you. Holds pay for themselves.')
  ],

  4: [
    placedChallenge('gateway', '🚦', 'Put an API gateway in front of your API', 'Open Server → Gateway tab and place it. Rate limiting turns away clients that call too often.'),
    {
      id: 'bots-blocked',
      icon: '🛑',
      info: 'rateLimiting',
      label: 'Block 40,000 scalper requests',
      hint: 'Once the gateway is in place it rejects ~95% of bot requests with "429 Too Many Requests".',
      progress: gs => ({ value: Math.round(gs.liveStats.botsBlocked || 0), target: 40000, unit: 'blocked' })
    },
    usersChallenge(800, 'Bots were eating your capacity. With them gone, check what runs out first.'),
    incidentChallenge('bots', {
      label: 'Survive a scalper swarm (under 5% failed requests)',
      hint: 'During a swarm bot traffic triples or quadruples. With a rate-limiting gateway it barely matters.'
    })
  ],

  5: [
    placedChallenge('lb', '⚖️', 'Add a load balancer', 'Open Server → LB tab and place it. Then the App tab lets you add more app servers.'),
    {
      id: 'three-apps',
      icon: '🖥️',
      info: 'horizontalScaling',
      label: 'Run 3 app servers',
      hint: 'Server → App tab → "Add app server". Any server can show any event, so with 3, one can crash and two cope.',
      progress: gs => ({ value: gs.appCount(), target: 3, unit: 'servers' })
    },
    usersChallenge(1800, 'Add app servers instead of buying bigger ones. "Archive past shows" (Code fixes) keeps the ticket table small.'),
    incidentChallenge('crash')
  ],

  6: [
    placedChallenge('cache', '⚡', 'Add an event cache', 'Open Server → Cache tab and place it. Event, venue and seat-map data is kept in memory.'),
    {
      id: 'hit-rate',
      icon: '🎯',
      info: 'cache',
      label: 'Cache hit rate 85% or more',
      hint: 'Event data hardly changes, so almost every page view is answered from memory.',
      progress: gs => {
        const hit = gs.serverStatus?.cacheHit ?? 0;
        return { value: hit >= 0.85 ? 1 : 0, target: 1, unit: '', display: `Hit rate ${Math.round(hit * 100)}%` };
      }
    },
    dbCpuUnder(50, 2500, 'cache', 'With the cache the database only sees misses and bookings.'),
    latencyChallenge(45, 2500, 'Pages from memory are fast. Keep every machine under ~70% busy.'),
    profitChallenge(9000, 'With the cache, the database can be smaller. Running fewer, cheaper machines earns more.')
  ],

  7: [
    fixOwned('searchIndex', '🔍', 'searchIndex', 'Build a search index',
      'Server → Code fixes → Search index. Searches look words up in an index instead of scanning every event.'),
    {
      id: 'searches',
      icon: '🔎',
      info: 'searchIndex',
      label: 'Search answers in under 60 ms with 3,000+ users',
      hint: 'Latency counts searches too. Without the index, they get slower with every event you list.',
      progress: gs => {
        const ok = gs.users >= 3000 && (gs.metrics?.latency || 999) < 60;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${gs.metrics?.latency || 0} ms at ${gs.users.toLocaleString()} users` };
      }
    },
    usersChallenge(3000, 'With searches cheap again, check what runs out first.'),
    incidentChallenge('spike')
  ],

  8: [
    placedChallenge('queue', '🚪', 'Open a virtual waiting room', 'Open Server → Waiting room tab and place it. Fans wait in line and are let in to book a batch at a time.'),
    {
      id: 'queued-fans',
      icon: '🧍',
      info: 'waitingRoom',
      label: 'Hold 100,000 "book now!" presses fairly in line',
      hint: 'Counts on-sale attempts the waiting room keeps in order instead of letting them hit the database.',
      progress: gs => ({ value: Math.round(gs.liveStats.fairQueued || 0), target: 100000, unit: 'in line' })
    },
    cleanRequests(3500, 'Without a waiting room every press checks seat locks in the database. With one, check what runs out first.'),
    usersChallenge(3500, 'The waiting room needs RAM for everyone in line. Check what runs out first.'),
    profitChallenge(15000, 'A steady line is far cheaper than a database big enough for the stampede.')
  ]
};
