/**
 * Ticket booking — the guided walkthrough for each level.
 */

import { CODE_FIXES } from '../../data/codeFixes.js';
import { newMachineSteps } from '../../game/Tutorial.js';
import { firstLevelSteps, databaseLevelSteps, fixLevelSteps } from '../firstSteps.js';

const LEVEL_1 = firstLevelSteps({
  welcome: "Hi, I'm Archie! Let's build a <strong>ticket site</strong> like Ticketmaster. It starts as <strong>one machine</strong> that shows events and books seats.",
  parts: 'A server is 4 parts: <strong>CPU</strong> does the work, <strong>RAM</strong> holds fans in memory, <strong>Storage</strong> saves the tickets, <strong>Network</strong> sends seat maps.',
  goLive: 'Your server does two things. <code>GET /api/events/:id</code> shows an event and its seat map. <code>POST /api/bookings</code> books seats. Fans look far more often than they buy.'
});

const LEVEL_2 = databaseLevelSteps({
  welcome: 'Level 2! Every show adds <strong>thousands of ticket rows</strong>, one per seat, and every seat map scans them on the machine that runs your code. Give the tickets <strong>their own database</strong>.',
  buy: 'On the <strong>Database</strong> tab, build a database server. Disk <strong>space</strong> matters: every seat is a row.',
  dataGrows: 'Watch the tickets grow. Each seat map scans every ticket. Look at <strong>Code fixes</strong>: an index on (event, seat) finds one event\'s seats directly.'
});

const LEVEL_3 = fixLevelSteps({
  welcome: 'Level 3! Fans <strong>paid and then lost their seat</strong>: paying takes minutes, and someone else bought it meanwhile. Every double sale is a failed booking and a refund.',
  fix: 'holds',
  buy: `Open <strong>Server → Code fixes</strong> and buy <strong>${CODE_FIXES.holds.icon} Hold seats during checkout</strong>. Picking a seat reserves it for 10 minutes; others see it as taken.`,
  explain: 'Each booking is now <strong>reserve, then confirm</strong>. If a fan walks away, the hold simply expires. Check <strong>Goals</strong>.'
});

const LEVEL_4 = newMachineSteps({
  role: 'gateway',
  welcome: 'Level 4! <strong>Scalper bots</strong> reload your seat maps nonstop, looking for good seats to resell: two bot requests for every real fan. Put an <strong>API gateway</strong> at the front door.',
  buy: 'The gateway looks at every API call, so it needs some CPU. Its <strong>rate limiting</strong> lets each client call only so often and answers the rest with "429 Too Many Requests". (Closed it? Tap Server again.)',
  explain: 'Bots now bounce off the gateway before they reach your app. Watch the blocked counter in <strong>Goals</strong>.'
});

const LEVEL_5 = newMachineSteps({
  role: 'lb',
  welcome: 'Level 5! <strong>1,800 fans</strong> browse at once, 100 views for every booking. One app server can\'t keep up, and when it crashes nobody can buy. Time to <strong>scale out</strong>.',
  buy: 'The load balancer spreads requests across app servers and skips any that are down. A small one is fine. (Closed it? Tap Server again.)',
  extra: [{
    id: 'add_apps',
    builderTab: 'app',
    text: () => 'Now add app servers: <strong>Server → App tab → Add app server</strong>. Any server can show any event (they are <em>stateless</em>). Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'appServerPlaced'
  }],
  explain: 'That\'s <strong>horizontal scaling</strong>. Past shows still fill the database: <strong>Archive past shows</strong> (Code fixes) keeps it small. Check <strong>Goals</strong>.'
});

const LEVEL_6 = newMachineSteps({
  role: 'cache',
  welcome: 'Level 6! A big tour is on sale and thousands of fans load <strong>the same event page</strong>. Each load joins events, venues and tickets in the database. Keep that data in a <strong>cache</strong>.',
  buy: 'A cache is mostly <strong>RAM</strong>. Event and venue details hardly ever change, so they can stay in memory for a long time. (Closed it? Tap Server again.)',
  explain: 'Most page views now come from memory; the database sees misses and bookings. Check the <strong>hit rate</strong> in <strong>Goals</strong>.'
});

const LEVEL_7 = fixLevelSteps({
  welcome: 'Level 7! Fans now <strong>search</strong> for shows. Each search runs <code>LIKE \'%taylor%\'</code>, which reads every event, and gets slower with every show you list.',
  fix: 'searchIndex',
  buy: `Open <strong>Server → Code fixes</strong> and buy <strong>${CODE_FIXES.searchIndex.icon} Search index</strong>: an index from each word to the events that contain it, like Elasticsearch.`,
  explain: 'Searches look words up instead of scanning rows, and the cache answers repeated ones. Check <strong>Goals</strong>.'
});

const LEVEL_8 = newMachineSteps({
  role: 'queue',
  welcome: 'Level 8! The <strong>biggest tour of the year</strong> goes on sale at 10:00. Every fan presses "book" again and again, and each press checks seat locks in the database. Put fans in a <strong>virtual waiting room</strong>.',
  buy: 'The queue keeps fans in arrival order, tells each one their place, and lets a batch in at a time. It needs <strong>RAM</strong> for everyone in line. (Closed it? Tap Server again.)',
  explain: 'The booking system now sees a steady stream instead of a stampede, and fans get a fair place in line. Check <strong>Goals</strong>.'
});

export const TICKETING_STEPS = {
  1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4,
  5: LEVEL_5, 6: LEVEL_6, 7: LEVEL_7, 8: LEVEL_8
};

export const TICKETING_LEVEL_ROLE = { 1: 'app', 2: 'db', 4: 'gateway', 5: 'lb', 6: 'cache', 8: 'queue' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
export function ticketingSuggestedFix(gs, role, partId) {
  const level = gs.level;
  const f = gs.codeFixes;
  if (level >= 2 && (role === 'db' || role === 'app') && (partId === 'cpu' || partId === 'storage') && !f.index) return CODE_FIXES.index;
  if (level >= 3 && !f.holds) return CODE_FIXES.holds;
  if (level >= 5 && role === 'db' && !f.archive) return CODE_FIXES.archive;
  if (level >= 7 && role === 'db' && !f.searchIndex) return CODE_FIXES.searchIndex;
  return null;
}
