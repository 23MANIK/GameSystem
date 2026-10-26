/**
 * Ad click aggregator — the guided walkthrough for each level.
 */

import { CODE_FIXES } from '../../data/codeFixes.js';
import { newMachineSteps } from '../../game/Tutorial.js';
import { firstLevelSteps, databaseLevelSteps, fixLevelSteps } from '../firstSteps.js';

const LEVEL_1 = firstLevelSteps({
  welcome: "Hi, I'm Archie! Let's build an <strong>ad click counter</strong> like the one behind Google Ads. Advertisers pay per click, so every click must be counted, once. It starts as <strong>one machine</strong>.",
  parts: 'A server is 4 parts: <strong>CPU</strong> does the work, <strong>RAM</strong> holds users in memory, <strong>Storage</strong> saves ads and clicks, <strong>Network</strong> sends responses. Redirects are tiny, so CPU and storage matter most.',
  goLive: 'Your server does three things. <code>GET /click/:adId</code> records the click and answers <em>302</em>, sending the visitor to the advertiser. <code>POST /api/ads</code> creates an ad. <code>GET /api/metrics</code> shows advertisers their clicks per minute.'
});

const LEVEL_2 = databaseLevelSteps({
  welcome: 'Level 2! Thousands of advertisers created ads, and every click looks its ad up by <strong>scanning every ad</strong>, on the machine that runs your code. Give the data <strong>its own database</strong>.',
  buy: 'On the <strong>Database</strong> tab, build a database server. Every click is a write, so disk <strong>speed</strong> matters.',
  dataGrows: 'Watch the clicks. Each one finds its ad by scanning the table. Look at <strong>Code fixes</strong>: an index on the ad ID finds it directly.'
});

const LEVEL_3 = newMachineSteps({
  role: 'queue',
  welcome: 'Level 3! A big campaign launched: <strong>clicks are pouring in</strong>. Each one is a database write the visitor waits for before the redirect. Put a <strong>message queue</strong> in between.',
  buy: 'The queue is an append-only log, like Kafka: a click is safe once the log has it. A worker reads clicks in batches and writes one row per 50. (Closed it? Tap Server again.)',
  explain: 'Redirects now return at once, and the database sees a trickle of batched writes. Check <strong>Goals</strong>.'
});

const LEVEL_4 = fixLevelSteps({
  welcome: 'Level 4! Advertisers watch their campaigns live, and each dashboard refresh runs <code>GROUP BY</code> over <strong>millions of raw clicks</strong>. Dashboards take seconds and the database is drowning.',
  fix: 'rollups',
  buy: `Open <strong>Server → Code fixes</strong> and buy <strong>${CODE_FIXES.rollups.icon} Stream aggregation</strong>: a stream processor (like Flink) reads clicks from the queue and keeps a counter per ad per minute.`,
  explain: 'Dashboards now read a few pre-counted rows. The current minute updates every few seconds. Check <strong>Goals</strong>.'
});

const LEVEL_5_MACHINE = newMachineSteps({
  role: 'cache',
  welcome: 'Level 5! An advertiser compared your bill with their own analytics: <strong>8% too many clicks</strong>. Double clicks, retries and replayed clicks are counted again. You need to remember which clicks you already counted.',
  buy: 'This cache holds recent <strong>impression IDs</strong> in memory, so it needs <strong>RAM</strong>. (Closed it? Tap Server again.)',
  extra: [{
    id: 'dedup',
    builderTab: 'code',
    text: () => `Now buy <strong>${CODE_FIXES.dedupIds.icon} Signed impression IDs</strong> on the <strong>Code fixes</strong> tab. Each ad view gets a unique, signed ID; a click whose ID was seen is dropped.`,
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'codeFixBought'
  }],
  explain: 'Each impression is now counted once, and forged IDs fail the signature check. Watch the accuracy in <strong>Goals</strong>.'
});

const LEVEL_6 = newMachineSteps({
  role: 'lb',
  welcome: 'Level 6! <strong>Prime time</strong>: clicks triple in the evening, and when your one click processor crashes, clicks in flight are lost. Time to <strong>scale out</strong>.',
  buy: 'The load balancer spreads clicks across processors and skips any that are down. A small one is fine. (Closed it? Tap Server again.)',
  extra: [{
    id: 'add_apps',
    builderTab: 'app',
    text: () => 'Now add click processors: <strong>Server → App tab → Add app server</strong>. They keep no state, so any of them can take any click. Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'appServerPlaced'
  }],
  explain: 'That\'s <strong>horizontal scaling</strong>. Check <strong>Goals</strong>, and watch for crashes.'
});

const LEVEL_7 = fixLevelSteps({
  welcome: 'Level 7! A sneaker ad <strong>went viral</strong>: a third of all clicks are on that one ad. The queue splits clicks by ad, so <strong>one partition</strong> takes them all while the others sit idle.',
  fix: 'saltKeys',
  buy: `Open <strong>Server → Code fixes</strong> and buy <strong>${CODE_FIXES.saltKeys.icon} Split hot ads</strong>: hot ads get the keys AdId:0…N, so their clicks spread over many partitions.`,
  explain: 'The aggregator strips the suffix and adds the partial counts back together. Watch the queue\'s CPU in <strong>Goals</strong>.'
});

const LEVEL_8_MACHINE = newMachineSteps({
  role: 'blob',
  welcome: 'Level 8! Finance found that live counts run <strong>about 6% short</strong>: aggregators restart, and late clicks miss their minute. Advertisers are under-billed. Keep <strong>every raw click</strong> somewhere cheap.',
  buy: 'This is a <strong>data lake</strong>: object storage (like S3) holding every raw click in big files. Nobody queries it live. (Closed it? Tap Server again.)',
  extra: [{
    id: 'reconcile',
    builderTab: 'code',
    text: () => `Now buy <strong>${CODE_FIXES.reconcile.icon} Nightly reconciliation</strong> on the <strong>Code fixes</strong> tab: a batch job recounts the raw clicks and corrects the live totals.`,
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'codeFixBought'
  }],
  explain: 'A fast layer for live counts and an exact layer that corrects them: the <strong>Lambda architecture</strong>. Check <strong>Goals</strong>.'
});

const LEVEL_9 = [
  {
    id: 'welcome',
    text: () => 'Level 9! Advertisers slice every count by campaign, country and device, every minute. The count rows <strong>outgrow one database</strong>. Split them across <strong>shards</strong> by advertiser.',
    button: 'Show me'
  },
  {
    id: 'add_shards',
    builderTab: 'db',
    text: () => 'Open <strong>Server → Database tab → Add shard</strong>. Each shard holds some advertisers\' counts, so one dashboard reads one shard. Aim for 3.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbShardPlaced'
  },
  {
    id: 'done',
    text: () => 'Writes and disk space now spread across shards. Check <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

export const AD_CLICKS_STEPS = {
  1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4, 5: LEVEL_5_MACHINE,
  6: LEVEL_6, 7: LEVEL_7, 8: LEVEL_8_MACHINE, 9: LEVEL_9
};

export const AD_CLICKS_LEVEL_ROLE = { 1: 'app', 2: 'db', 3: 'queue', 5: 'cache', 6: 'lb', 8: 'blob' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
export function adClicksSuggestedFix(gs, role, partId) {
  const level = gs.level;
  const f = gs.codeFixes;
  if (level >= 2 && (role === 'db' || role === 'app') && (partId === 'cpu' || partId === 'storage') && !f.index) return CODE_FIXES.index;
  if (level >= 4 && role === 'db' && !f.rollups) return CODE_FIXES.rollups;
  if (level >= 5 && role === 'cache' && !f.dedupIds) return CODE_FIXES.dedupIds;
  if (level >= 7 && role === 'queue' && !f.saltKeys) return CODE_FIXES.saltKeys;
  return null;
}
