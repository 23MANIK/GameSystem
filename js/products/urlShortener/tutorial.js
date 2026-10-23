/**
 * URL shortener — the guided walkthrough for each level (same step shapes as
 * the Guestbook's, see js/game/Tutorial.js).
 */

import { SERVER_PARTS } from '../../data/serverParts.js';
import { CODE_FIXES } from '../../data/codeFixes.js';
import { newMachineSteps, ROLE_NAME, suggestedFix } from '../../game/Tutorial.js';

const LEVEL_1 = [
  {
    id: 'welcome',
    text: () => "Hi, I'm Archie! Let's build a <strong>link shortener</strong> like bit.ly. It starts as <strong>one machine</strong> that stores links and answers redirects.",
    button: "Let's build"
  },
  {
    id: 'open_builder',
    text: () => 'Tap <strong>Server</strong> at the bottom to open the Server Builder.',
    highlight: '#nav-server',
    advanceOn: 'serverBuilderOpened'
  },
  {
    id: 'pick_parts',
    text: () => 'A server is 4 parts: <strong>CPU</strong> does the work, <strong>RAM</strong> holds users in memory, <strong>Storage</strong> saves the links, <strong>Network</strong> sends responses. Redirects are tiny, so CPU matters most. Pick parts and press <strong>Buy</strong>. (Closed it? Tap Server again.)',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverBought'
  },
  {
    id: 'place',
    text: () => 'Now click the glowing slot to place your server.',
    advanceOn: 'serverPlaced'
  },
  {
    id: 'go_live',
    text: () => 'Your server does two things. <code>POST /api/shorten</code> saves a long URL and returns a short code. <code>GET /{code}</code> looks the code up and answers <em>302 Found</em>, sending the browser on to the long URL. Clicks (reads) far outnumber new links (writes). Users also bring you coins.',
    highlight: '#hud-resources',
    button: 'Open to the public',
    onButton: gs => { gs.appLive = true; }
  },
  {
    id: 'grow',
    text: () => 'To finish this level, complete every goal in <strong>Goals</strong>. Each has a hint, and any <span class="info-glyph">i</span> button explains more. Your server costs coins every minute. I\'ll tell you when a part gets busy.',
    highlight: '#nav-goals',
    button: 'Got it',
    minimizeAfterButton: true,
    advanceOn: 'partWarning'
  },
  {
    id: 'bottleneck',
    text: (gs, ctx) => {
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
      const pct = Math.round((gs.serverStatus?.usage?.[part.id] || 0.8) * 100);
      return `${part.icon} <strong>${part.short}</strong> is at <strong>${pct}%</strong>, so it will run out first: your <em>bottleneck</em>. ${part.whenFull} Tap <strong>Server</strong> (or your server on the map, then <strong>Upgrade</strong>) and buy a bigger ${part.short}.`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverUpgraded'
  },
  {
    id: 'scaled',
    text: () => 'That\'s <strong>vertical scaling</strong>: making the one machine bigger. Each time a part fills up, upgrade the one that runs out first. Check <strong>Goals</strong> for what\'s left.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_2 = [
  {
    id: 'welcome',
    text: () => 'Level 2! Marketing teams create links in bulk: <strong>2.5× more new links</strong>. Every redirect must find one row among thousands, on the same machine that runs your code. Give the links <strong>their own database</strong>.',
    button: 'Show me'
  },
  {
    id: 'open_db',
    text: () => 'Tap <strong>Server</strong>. The builder now has tabs: <strong>App server</strong>, <strong>Database</strong> and <strong>Code fixes</strong>.',
    highlight: '#nav-server',
    advanceOn: 'serverBuilderOpened'
  },
  {
    id: 'buy_db',
    text: () => 'On the <strong>Database</strong> tab, build a database server. Disk <strong>space</strong> matters now: every link is a row. (Closed it? Tap Server again.)',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbBought'
  },
  {
    id: 'place_db',
    text: () => 'Click the glowing slot to place the database. It connects to your app server automatically.',
    advanceOn: 'dbPlaced'
  },
  {
    id: 'data_grows',
    text: () => 'Now watch the links table grow. Without an <strong>index</strong>, every redirect reads <em>every row</em> to find one code, and every new link first checks "is this code taken?". Bigger machines only buy time: look at <strong>Code fixes</strong>. I\'ll tell you when something gets busy.',
    highlight: '#hud-resources',
    button: 'Got it',
    minimizeAfterButton: true,
    advanceOn: 'partWarning'
  },
  {
    id: 'bottleneck',
    text: (gs, ctx) => {
      const role = ctx?.role || gs.serverStatus?.busiestRole || 'db';
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
      const pct = Math.round((gs.serverStatus?.servers?.[role]?.usage?.[part.id] || 0.8) * 100);
      const fix = suggestedFix(gs, role, part.id);
      const advice = fix
        ? `A bigger ${part.short} helps for a while, but the real problem is the code: try <strong>${fix.icon} ${fix.name}</strong> on the <strong>Code fixes</strong> tab. ${fix.short}`
        : `Open <strong>Server</strong>, pick the ${ROLE_NAME[role] || role} tab and buy a bigger ${part.short}.`;
      return `${part.icon} The <strong>${ROLE_NAME[role] || role}'s ${part.short}</strong> is at <strong>${pct}%</strong>. ${advice}`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: ['serverUpgraded', 'codeFixBought']
  },
  {
    id: 'done',
    text: () => 'Each time something fills up, ask: <strong>bigger machine, or better code?</strong> The index finds a code in ~1 ms; Base62 codes need no "is it taken?" check. Keep an eye on <strong>disk space</strong>. Check <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_3 = newMachineSteps({
  role: 'gateway',
  welcome: 'Level 3! <strong>Spam scripts</strong> found your free API: about 30 spam links for every real one. Each is a database write and a row on your disk, and they never pay. Put an <strong>API gateway</strong> at the front door.',
  buy: 'The gateway looks at every API call (spam too), so it needs some CPU. Its <strong>rate limiting</strong> lets each client create only so many links per minute and answers the rest with "429 Too Many Requests". (Closed it? Tap Server again.)',
  explain: 'Spam now bounces off the gateway before it reaches your app or your disk. Watch the blocked counter in <strong>Goals</strong>, and get ready for a spam attack.'
});

const LEVEL_4 = newMachineSteps({
  role: 'lb',
  welcome: 'Level 4! A news site shortens every article with you: <strong>1,500 users</strong>, more than any one app server can take. And when your only app server crashes, every short link breaks. Time to <strong>scale out</strong>.',
  buy: 'The load balancer spreads requests across app servers and skips any that are down. It is light work: a small one is fine. Bigger <strong>XL parts</strong> also unlocked (dashed cards). (Closed it? Tap Server again.)',
  extra: [{
    id: 'add_apps',
    builderTab: 'app',
    text: () => 'Now add app servers: <strong>Server → App tab → Add app server</strong>. A redirect needs no session, so any server can answer any click (they are <em>stateless</em>). Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'appServerPlaced'
  }],
  explain: 'That\'s <strong>horizontal scaling</strong> with stateless servers: add one whenever you need more. Links keep piling up: <strong>Expire old links</strong> (Code fixes) keeps the table from growing forever. Check <strong>Goals</strong>, and watch for crashes.'
});

const LEVEL_5 = newMachineSteps({
  role: 'cache',
  welcome: 'Level 5! A link went <strong>viral</strong>: clicks are up 50%, and most of them ask for the same few codes. Every click still hits your one database. Put a <strong>cache</strong> in front of it.',
  buy: 'A cache is mostly <strong>RAM</strong>: it keeps the hot code → URL pairs in memory. Because a few links get most clicks, even a small cache answers 90%+ of redirects. (Closed it? Tap Server again.)',
  explain: 'Redirects check the cache first; only misses reach the database. Check the <strong>hit rate</strong> and the database CPU in <strong>Goals</strong>.'
});

const LEVEL_6 = newMachineSteps({
  role: 'queue',
  welcome: 'Level 6! Customers want <strong>click analytics</strong>. Right now every redirect also writes <code>clicks = clicks + 1</code> to the database before answering. That\'s a database write per click. Add a <strong>message queue</strong>.',
  buy: 'A queue (like Kafka) is an append-only log: redirects drop a small click event in and answer straight away. A worker reads events in batches and writes <strong>one row per 50 clicks</strong>. It needs RAM and network more than CPU. (Closed it? Tap Server again.)',
  explain: 'Clicks are now counted <strong>asynchronously</strong>: the user never waits for analytics, and the database sees 50× fewer writes. Check <strong>Goals</strong>.'
});

// Level 7: first split the data (shards), then fix the clashing codes (ID generator)
const LEVEL_7_MACHINE = newMachineSteps({
  role: 'idgen',
  welcome: '',
  buy: 'The ID generator is a tiny machine (think Redis <code>INCR</code>): every new link asks it for the next number, so codes are unique across all shards. Later, <strong>Hand out ID ranges</strong> (Code fixes) lets each app server take 1,000 at a time. (Closed it? Tap Server again.)',
  explain: 'Links are split across shards by code, and one counter keeps every code unique. Each shard adds disk space and write capacity. Check <strong>Goals</strong>.'
});

const LEVEL_7 = [
  {
    id: 'welcome',
    text: () => 'Level 7! Partners create links by the million. One database disk can\'t hold them all, and no machine is big enough. Split the links across several databases: <strong>shards</strong>.',
    button: 'Show me'
  },
  {
    id: 'add_shards',
    builderTab: 'db',
    text: () => 'Open <strong>Server → Database tab → Add shard</strong>. Each shard holds a slice of the links, picked by a hash of the short code, so you get more disks and more CPUs. Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbShardPlaced'
  },
  {
    id: 'clash',
    text: () => '⚠️ Problem: each shard counts its own IDs, so shard 1 and shard 2 can both make code <code>aZ3kQ9x</code>. That\'s a <strong>clash</strong>: one link breaks. (Hashing instead means checking <em>every</em> shard on each new link.) You need <strong>one ID generator</strong> for everyone.',
    button: 'Fix it'
  },
  ...LEVEL_7_MACHINE.slice(1).map(s => (s.id === 'open'
    ? { ...s, text: () => 'Tap <strong>Server</strong>. It opens on the new <strong>🔢 IDs</strong> tab.' }
    : s))
];

const LEVEL_8 = newMachineSteps({
  role: 'cdn',
  welcome: 'Level 8! Your links are clicked worldwide: <strong>60% of clicks come from other continents</strong> and wait ~120 ms before your servers even start. Answer redirects <strong>at the edge</strong>, near each user.',
  buy: 'The CDN answers popular redirects from a nearby city and logs each click to your queue. About 80% of clicks never reach your servers. (Closed it? Tap Server again.)',
  explain: 'Code fixes now has a <strong>301 / 302</strong> switch. A 301 lets browsers remember the redirect: less traffic, but you stop seeing those clicks. Customers pay for click counts, so choose carefully. Check <strong>Goals</strong>.'
});

export const URL_SHORTENER_STEPS = {
  1: LEVEL_1,
  2: LEVEL_2,
  3: LEVEL_3,
  4: LEVEL_4,
  5: LEVEL_5,
  6: LEVEL_6,
  7: LEVEL_7,
  8: LEVEL_8
};

export const URL_SHORTENER_LEVEL_ROLE = { 1: 'app', 2: 'db', 3: 'gateway', 4: 'lb', 5: 'cache', 6: 'queue', 7: 'idgen', 8: 'cdn' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
export function urlShortenerSuggestedFix(gs, role, partId) {
  const level = gs.level;
  if ((role === 'db' || role === 'app') && (partId === 'cpu' || partId === 'storage') && !gs.codeFixes.index && level >= 2) return CODE_FIXES.index;
  if (role === 'db' && !gs.codeFixes.base62 && level >= 2) return CODE_FIXES.base62;
  if (role === 'idgen' && !gs.codeFixes.idRanges) return CODE_FIXES.idRanges;
  return null;
}
