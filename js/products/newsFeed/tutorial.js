/**
 * News feed — the guided walkthrough for each level (same step shapes as
 * the Guestbook's, see js/game/Tutorial.js).
 */

import { SERVER_PARTS } from '../../data/serverParts.js';
import { CODE_FIXES } from '../../data/codeFixes.js';
import { newMachineSteps, ROLE_NAME, suggestedFix } from '../../game/Tutorial.js';

const LEVEL_1 = [
  {
    id: 'welcome',
    text: () => "Hi, I'm Archie! Let's build a <strong>news feed</strong> like Twitter or Instagram. It starts as <strong>one machine</strong> that stores posts and builds each person's feed.",
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
    text: () => 'A server is 4 parts: <strong>CPU</strong> does the work, <strong>RAM</strong> holds users in memory, <strong>Storage</strong> saves the posts, <strong>Network</strong> sends feeds. Pick parts and press <strong>Buy</strong>. (Closed it? Tap Server again.)',
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
    text: () => 'Your server does two things. <code>POST /api/posts</code> saves a post. <code>GET /api/feed</code> collects the newest posts of everyone you follow. Feeds are read far more often than posts are written. Users also bring you coins.',
    highlight: '#hud-resources',
    button: 'Open to the public',
    onButton: gs => { gs.appLive = true; }
  },
  {
    id: 'grow',
    text: () => 'To finish this level, complete every goal in <strong>Goals</strong>. Each has a hint, and any <span class="info-glyph">i</span> button explains more. I\'ll tell you when a part gets busy.',
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
      return `${part.icon} <strong>${part.short}</strong> is at <strong>${pct}%</strong>, so it will run out first: your <em>bottleneck</em>. ${part.whenFull} Tap <strong>Server</strong> and buy a bigger ${part.short}.`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverUpgraded'
  },
  {
    id: 'scaled',
    text: () => 'That\'s <strong>vertical scaling</strong>: making the one machine bigger. Check <strong>Goals</strong> for what\'s left.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_2 = [
  {
    id: 'welcome',
    text: () => 'Level 2! Posts pile up by the thousand. Every feed load reads <strong>every followee\'s posts</strong> and returns all of them, on the same machine that runs your code. Give the posts <strong>their own database</strong>.',
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
    text: () => 'On the <strong>Database</strong> tab, build a database server. Disk <strong>space</strong> matters: every post is a row. (Closed it? Tap Server again.)',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbBought'
  },
  {
    id: 'place_db',
    text: () => 'Click the glowing slot to place the database.',
    advanceOn: 'dbPlaced'
  },
  {
    id: 'data_grows',
    text: () => 'Watch the posts grow. Each feed returns <em>every</em> post, and the database scans them all. Look at <strong>Code fixes</strong>: cursor pagination and an index on (author, time). I\'ll tell you when something gets busy.',
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
    text: () => 'Each time something fills up, ask: <strong>bigger machine, or better code?</strong> Check <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_3 = newMachineSteps({
  role: 'gateway',
  welcome: 'Level 3! <strong>Spam bots</strong> found your network: about 20 spam posts for every real one. Each is a database write and a row on disk. Put an <strong>API gateway</strong> at the front door.',
  buy: 'The gateway looks at every API call, so it needs some CPU. Its <strong>rate limiting</strong> lets each account post only so often and answers the rest with "429 Too Many Requests". (Closed it? Tap Server again.)',
  explain: 'Spam now bounces off the gateway before it reaches your app or your disk. Watch the blocked counter in <strong>Goals</strong>.'
});

const LEVEL_4 = newMachineSteps({
  role: 'lb',
  welcome: 'Level 4! <strong>1,500 users</strong> scroll all day, 50 reads per post. One app server can\'t keep up, and when it crashes the feed is gone. Time to <strong>scale out</strong>.',
  buy: 'The load balancer spreads requests across app servers and skips any that are down. A small one is fine. (Closed it? Tap Server again.)',
  extra: [{
    id: 'add_apps',
    builderTab: 'app',
    text: () => 'Now add app servers: <strong>Server → App tab → Add app server</strong>. Any server can build any feed (they are <em>stateless</em>). Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'appServerPlaced'
  }],
  explain: 'That\'s <strong>horizontal scaling</strong>. Posts keep piling up: <strong>Keep the newest feed window</strong> (Code fixes) keeps the hot table small. Check <strong>Goals</strong>, and watch for crashes.'
});

const LEVEL_5 = newMachineSteps({
  role: 'cache',
  welcome: 'Level 5! Every scroll merges the posts of everyone you follow: the database is drowning. <strong>Precompute</strong> each feed as a list of post IDs in a <strong>cache</strong>.',
  buy: 'A cache is mostly <strong>RAM</strong>: it keeps each active user\'s feed list in memory. A scroll becomes one lookup. (Closed it? Tap Server again.)',
  explain: 'Scrolls now read one list from the cache. The price: each new post must be written into its followers\' lists (<em>fan-out on write</em>). Check <strong>Goals</strong>.'
});

const LEVEL_6 = newMachineSteps({
  role: 'queue',
  welcome: 'Level 6! Each post is copied into <strong>~30 followers\' feeds</strong> while the poster waits. Posting is slow and the app servers are busy. Move fan-out to the background with a <strong>message queue</strong>.',
  buy: 'The queue holds "new post" jobs; <strong>fan-out workers</strong> take them and write the post ID into each follower\'s feed. (Closed it? Tap Server again.)',
  explain: 'Posting now returns at once and feeds fill in a moment later: <strong>asynchronous fan-out</strong>. Check <strong>Goals</strong>.'
});

const LEVEL_7 = [
  {
    id: 'welcome',
    text: () => 'Level 7! <strong>Celebrities</strong> joined. Each of their posts must reach ~1,000× more feeds. The fan-out queue falls behind and feeds go stale. A bigger queue only buys time.',
    button: 'What can I do?'
  },
  {
    id: 'hybrid',
    builderTab: 'code',
    text: () => `Open <strong>Server → Code fixes</strong> and buy <strong>${CODE_FIXES.hybridFanout.icon} Hybrid fan-out</strong>: normal posts are still pushed into feeds, but celebrity posts are <em>pulled</em> in when a feed is read.`,
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'codeFixBought'
  },
  {
    id: 'done',
    text: () => 'Writes drop a lot; each read does a little more work. Watch the fan-out backlog in <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_8_MACHINE = newMachineSteps({
  role: 'idgen',
  welcome: '',
  buy: 'The ID generator hands out unique, time-ordered IDs (like Twitter\'s Snowflake), so posts on every shard sort correctly. <strong>Hand out ID ranges</strong> (Code fixes) lets each app server take a block at a time. (Closed it? Tap Server again.)',
  explain: 'Posts are split across shards, and one ID generator keeps every ID unique. Check <strong>Goals</strong>.'
});

const LEVEL_8 = [
  {
    id: 'welcome',
    text: () => 'Level 8! Posts arrive faster than one database can write or store them. Split them across several databases: <strong>shards</strong>.',
    button: 'Show me'
  },
  {
    id: 'add_shards',
    builderTab: 'db',
    text: () => 'Open <strong>Server → Database tab → Add shard</strong>. Each shard holds a slice of the posts. Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbShardPlaced'
  },
  {
    id: 'clash',
    text: () => '⚠️ Problem: each shard counts its own IDs, so two posts can get the same ID and feeds sort wrong. You need <strong>one ID generator</strong> for everyone.',
    button: 'Fix it'
  },
  ...LEVEL_8_MACHINE.slice(1).map(s => (s.id === 'open'
    ? { ...s, text: () => 'Tap <strong>Server</strong>. It opens on the new <strong>🔢 IDs</strong> tab.' }
    : s))
];

const LEVEL_9 = newMachineSteps({
  role: 'cdn',
  welcome: 'Level 9! Feeds are full of <strong>photos</strong>, and <strong>60% of users</strong> live on other continents: every photo crosses an ocean. Serve them <strong>from the edge</strong>.',
  buy: 'The CDN keeps photos in cities near each user. Most bytes never reach your servers. (Closed it? Tap Server again.)',
  explain: 'Photos load from nearby, and your origin only builds feed lists. Check <strong>Goals</strong>.'
});

export const NEWS_FEED_STEPS = {
  1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4, 5: LEVEL_5,
  6: LEVEL_6, 7: LEVEL_7, 8: LEVEL_8, 9: LEVEL_9
};

export const NEWS_FEED_LEVEL_ROLE = { 1: 'app', 2: 'db', 3: 'gateway', 4: 'lb', 5: 'cache', 6: 'queue', 8: 'idgen', 9: 'cdn' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
export function newsFeedSuggestedFix(gs, role, partId) {
  const level = gs.level;
  const f = gs.codeFixes;
  if (level >= 2 && (role === 'db' || role === 'app') && partId === 'network' && !f.pagination) return CODE_FIXES.pagination;
  if (level >= 2 && (role === 'db' || role === 'app') && (partId === 'cpu' || partId === 'storage') && !f.index) return CODE_FIXES.index;
  if (level >= 4 && role === 'db' && !f.archive) return CODE_FIXES.archive;
  if (level >= 7 && (role === 'queue' || role === 'cache') && !f.hybridFanout) return CODE_FIXES.hybridFanout;
  if (role === 'idgen' && !f.idRanges) return CODE_FIXES.idRanges;
  return null;
}
