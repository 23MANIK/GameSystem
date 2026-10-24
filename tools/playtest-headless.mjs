#!/usr/bin/env node
/**
 * playtest-headless.mjs — play every level of a product in Node, no browser.
 *
 *   node tools/playtest-headless.mjs news_feed [--json] [--seed 7]
 *   node tools/playtest-headless.mjs --pack game.json   (a data pack, see js/products/dataPack.js)
 *
 * Runs the real game systems (GameState, ResourceManager, LevelSystem,
 * TrafficSpikes, EventSystem, Challenges) with the same bot as
 * .claude/skills/design-product-levels/reference/playtest-bot.js:
 * buy every new machine, buy the level's code fixes, add app servers /
 * shards, and upgrade whatever runs out first.
 *
 * A pack can steer the bot with an optional `playtest` field:
 *   playtest: { fixes: { 2: ['index'] }, apps: { 4: 3 }, shards: { 7: 3 } }
 * Without it the bot buys every non-toggle fix as it unlocks, and adds app
 * servers / shards when they are the bottleneck.
 *
 * A level passes when its goals are all done within MAX_MINUTES simulated
 * minutes. Exit code 1 if any level fails. Randomness is seeded, so a run is
 * repeatable.
 */

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const seedArg = args.indexOf('--seed');
let seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 7;

// Repeatable randomness (spikes, incidents)
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const root = new URL('../js/', import.meta.url).href;
const registry = await import(root + 'products/registry.js');
const { productFromArgs } = await import('./designgame/pack-arg.mjs');
const productId = await productFromArgs(args);
if (!registry.hasPack(productId)) {
  console.error(`Unknown product "${productId}". Known: ${Object.keys(registry.PACKS).join(', ')}`);
  process.exit(2);
}
const { default: GameState } = await import(root + 'game/GameState.js');
const { default: LevelSystem } = await import(root + 'game/LevelSystem.js');
const { default: EventSystem } = await import(root + 'game/EventSystem.js');
const { default: ResourceManager } = await import(root + 'game/ResourceManager.js');
const { default: TrafficSpikes } = await import(root + 'game/TrafficSpikes.js');
const { evaluateChallenges } = await import(root + 'game/Challenges.js');
const levelsMod = await import(root + 'data/levels.js'); // live binding: the pack sets LEVELS later
const { ROLES, ROLE_TILES } = await import(root + 'data/roles.js');
const SP = await import(root + 'data/serverParts.js');
const CF = await import(root + 'data/codeFixes.js');

const TICK = 2; // seconds, as in the game
const MAX_MINUTES = 60;
const MIN_OK = 2, MAX_OK = 20; // a healthy level takes this many simulated minutes

const gs = new GameState();
gs.reset();
gs.productId = productId;
const pack = registry.activeProduct();
const plan = pack.playtest || {};
gs.coins = levelsMod.LEVELS[0].startingCoins;
const levels = new LevelSystem(gs);
const resources = new ResourceManager(gs, levels);
const events = new EventSystem(gs);
const spikes = new TrafficSpikes(gs);

function freeTile(role) {
  const used = new Set(gs.placedComponents.map(c => `${c.gridX},${c.gridY}`));
  return (ROLE_TILES[role] || []).find(t => !used.has(`${t.x},${t.y}`));
}

function place(role) {
  const t = freeTile(role);
  if (!t) return false;
  const id = gs.addComponent(ROLES[role].componentId, t.x, t.y);
  gs.recalculateMetrics();
  return Boolean(id);
}

function bump(role, part) {
  const now = gs.getServerConfig(role);
  if (!now) return false;
  const cfg = { ...now };
  const opts = SP.optionsForLevel(part, gs.level);
  const i = opts.findIndex(o => o.id === cfg[part]);
  if (i < 0 || i >= opts.length - 1) return false;
  cfg[part] = opts[i + 1].id;
  const cost = SP.upgradeCost(now, cfg) * Math.max(1, gs.machineCount(role));
  if (gs.coins < cost) return false;
  return gs.setServer(cfg, cost, role);
}

function wantFixes(L) {
  if (plan.fixes) return Object.entries(plan.fixes).filter(([l]) => Number(l) <= L).flatMap(([, f]) => f);
  return CF.fixesForLevel(L).filter(f => !f.toggle).map(f => f.id);
}

function addExtra(role) {
  if (!gs.coins || gs.coins < gs.extraMachineCost(role) + 200) return false;
  if (!gs.buyExtraMachine(role)) return false;
  place(role);
  return true;
}

function act() {
  const L = gs.level;
  const aud = gs.levelDef().audience || gs.users;
  // 1. Every machine this level offers
  for (const role of gs.availableRoles()) {
    if (gs.getServerConfig(role)) {
      if (!gs.isPlaced(role)) place(role);
      continue;
    }
    const c = SP.cheapestServer();
    const cost = SP.serverCost(c);
    if (gs.coins >= cost && gs.setServer(c, cost, role)) place(role);
  }
  // 2. Code fixes
  for (const f of wantFixes(L)) {
    const fix = CF.CODE_FIXES[f];
    if (fix && !gs.codeFixes[f] && gs.coins >= fix.cost + 300) gs.buyCodeFix(f, fix.cost);
  }
  // 3. Scale out
  const appRule = registry.scaleOutRule('app', L);
  const dbRule = registry.scaleOutRule('db', L);
  const st0 = gs.serverStatus;
  const wantApps = plan.apps?.[L];
  const wantShards = plan.shards?.[L];
  if (appRule && gs.isPlaced(appRule.needs || 'lb') && gs.appCount() < (ROLES.app.maxCount || 6)) {
    const need = wantApps ? gs.appCount() < wantApps : st0?.bottleneckRole === 'app' && st0.userLimit < aud * 1.3;
    if (need) addExtra('app');
  }
  if (dbRule && gs.isPlaced('db') && gs.dbCount() < (ROLES.db.maxCount || 4)) {
    const need = wantShards ? gs.dbCount() < wantShards : st0?.bottleneckRole === 'db' && (st0.userLimit < aud * 1.3 || st0.space?.pct > 0.75);
    if (need) addExtra('db');
  }
  // 4. Upgrades
  for (let k = 0; k < 2; k++) {
    const st = gs.serverStatus;
    if (st && st.peak > 0.72) bump(st.busiestRole, st.busiest);
  }
  for (let k = 0; k < 3; k++) {
    const st = gs.serverStatus;
    if (st && st.userLimit < Math.max(aud, 30) * 1.5) { if (!bump(st.bottleneckRole, st.bottleneck)) break; }
  }
  const st = gs.serverStatus;
  if (st && st.space?.capacity && st.space.pct > 0.7) {
    const role = st.space.role;
    const now = gs.getServerConfig(role);
    if (now) {
      const cfg = { ...now };
      const opts = SP.optionsForLevel('storage', L).filter(o => o.id !== 'disk_hdd');
      const best = opts.reduce((a, o) => (o.space > a.space ? o : a));
      if (SP.getOption('storage', cfg.storage).space < best.space) {
        cfg.storage = best.id;
        const cost = SP.upgradeCost(now, cfg) * Math.max(1, gs.machineCount(role));
        if (gs.coins >= cost) gs.setServer(cfg, cost, role);
      }
    }
  }
}

function tick() {
  if (gs.levelCompleted) return;
  spikes.tick(TICK);
  resources.tick(levels, TICK);
  const audience = gs.levelDef().audience;
  if (audience && gs.users >= audience) gs.achievements.audienceReached = true;
  if (gs.appLive && gs.isServerPlaced()) {
    const perSec = gs.serverStatus?.recordsPerSec ?? gs.users * gs.writesPerUser();
    gs.guestbook.simulateVisitors(perSec * (gs.serverStatus?.diskFull ? 0 : 1) * TICK);
  }
  if (levels.getAvailableEvents().length > 0) events.tick();
  gs.recalculateMetrics();
  evaluateChallenges(gs);
  levels.checkLevelUp();
}

function runLevel() {
  const coinsAtStart = Math.round(gs.coins);
  gs.appLive = true;
  let t = 0;
  const maxTicks = MAX_MINUTES * 60 / TICK;
  let stuckCoins = null;
  for (; t < maxTicks && !gs.levelCompleted; t++) {
    act();
    tick();
  }
  const ev = evaluateChallenges(gs);
  const minutes = Math.round(t * TICK / 60 * 10) / 10;
  const st = gs.serverStatus || {};
  const notes = [];
  if (gs.levelCompleted && minutes < MIN_OK) notes.push('too quick');
  if (gs.levelCompleted && minutes > MAX_OK) notes.push('slow');
  return {
    level: gs.level, name: gs.levelDef().name, done: gs.levelCompleted, minutes, users: Math.round(gs.users),
    pending: ev.results.filter(r => !r.done).map(r => `${r.id}: ${r.display || `${Math.round(r.value)}/${r.target}`}`),
    bottleneck: `${st.bottleneckRole}.${st.bottleneck}`, latency: gs.metrics?.latency,
    coinsAtStart, coinsEnd: Math.round(gs.coins), funding: gs.fundingHistory?.at(-1)?.amount ?? 0,
    apps: gs.appCount(), shards: gs.dbCount(), notes, stuckCoins
  };
}

const results = [runLevel()];
while (gs.levelCompleted && levelsMod.LEVELS[gs.level] && !levelsMod.LEVELS[gs.level].comingSoon) {
  gs.startLevel(gs.level + 1);
  results.push(runLevel());
}
const passed = results.length === levelsMod.LEVELS.filter(l => !l.comingSoon).length && results.every(r => r.done);

if (asJson) {
  console.log(JSON.stringify({ productId, passed, results }, null, 2));
} else {
  console.log(`\n${productId}: headless play-test (seed ${seedArg >= 0 ? args[seedArg + 1] : 7})\n`);
  for (const r of results) {
    console.log(`Level ${r.level} · ${r.name}: ${r.done ? 'DONE' : 'STUCK'} in ${r.minutes} min, ${r.users} users, coins ${r.coinsAtStart} → ${r.coinsEnd}`
      + `, apps ${r.apps} shards ${r.shards}, runs out: ${r.bottleneck}${r.notes.length ? ` [${r.notes.join(', ')}]` : ''}`);
    if (!r.done) console.log(`  pending: ${r.pending.join(' · ')}`);
  }
  console.log(`\n${passed ? 'PASS' : 'FAIL'}: ${results.filter(r => r.done).length}/${levelsMod.LEVELS.length} levels finished\n`);
}
process.exit(passed ? 0 : 1);
