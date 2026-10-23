// Paste into the browser console (or the javascript tool) on the running game,
// after picking the product. Fast-forwards every level and prints a summary
// line per level. Edit FIXES / WANT_APPS / WANT_SHARDS for the product.
//
//   FIXES:       code fixes to buy at each level
//   WANT_APPS:   app servers to run from each level
//   WANT_SHARDS: database shards to run from each level

const FIXES = { 2: ['index', 'base62'], 4: ['expiry'], 7: ['idRanges'] };
const WANT_APPS = { 4: 3, 5: 4, 6: 5, 7: 6, 8: 5 };
const WANT_SHARDS = { 7: 3 };

const g = window.__game, gs = g.gameState;
const SP = await import('/js/data/serverParts.js');
const CF = await import('/js/data/codeFixes.js');
const { evaluateChallenges } = await import('/js/game/Challenges.js');

function bump(role, part) {
  const cfg = { ...gs.getServerConfig(role) };
  const opts = SP.optionsForLevel(part, gs.level);
  const i = opts.findIndex(o => o.id === cfg[part]);
  if (i < 0 || i >= opts.length - 1) return false;
  cfg[part] = opts[i + 1].id;
  const cost = SP.upgradeCost(gs.getServerConfig(role), cfg) * Math.max(1, gs.machineCount(role));
  if (gs.coins < cost) return false;
  return gs.setServer(cfg, cost, role);
}

function act() {
  const L = gs.level;
  const aud = gs.levelDef().audience || gs.users;
  for (const role of gs.availableRoles()) {
    if (gs.getServerConfig(role)) continue;
    const c = SP.cheapestServer();
    const cost = SP.serverCost(c);
    if (gs.coins >= cost) {
      gs.setServer(c, cost, role);
      g.placing = null;
      const t = g.placementTiles(role)[0];
      g.placeMachine(role, t.x, t.y);
    }
  }
  for (const f of FIXES[L] || []) {
    if (!gs.codeFixes[f] && gs.coins >= CF.CODE_FIXES[f].cost + 300) gs.buyCodeFix(f, CF.CODE_FIXES[f].cost);
  }
  if (WANT_SHARDS[L] && gs.dbCount() < WANT_SHARDS[L] && gs.coins > gs.extraMachineCost('db') + 200) { gs.buyExtraMachine('db'); g.autoPlaceExtra('db'); }
  if (WANT_APPS[L] && gs.isPlaced('lb') && gs.appCount() < WANT_APPS[L] && gs.coins > gs.extraMachineCost('app') + 200) { gs.buyExtraMachine('app'); g.autoPlaceExtra('app'); }
  for (let k = 0; k < 2; k++) {
    const st = gs.serverStatus;
    if (st && st.peak > 0.72) bump(st.busiestRole, st.busiest);
  }
  for (let k = 0; k < 3; k++) {
    const st = gs.serverStatus;
    if (st && st.userLimit < Math.max(aud, 30) * 1.5) { if (!bump(st.bottleneckRole, st.bottleneck)) break; }
  }
  const st = gs.serverStatus;
  if (st && st.space.capacity && st.space.pct > 0.7) {
    const role = st.space.role;
    const cfg = { ...gs.getServerConfig(role) };
    const opts = SP.optionsForLevel('storage', L).filter(o => o.id !== 'disk_hdd');
    const best = opts.reduce((a, o) => (o.space > a.space ? o : a));
    if (SP.getOption('storage', cfg.storage).space < best.space) {
      cfg.storage = best.id;
      const cost = SP.upgradeCost(gs.getServerConfig(role), cfg) * Math.max(1, gs.machineCount(role));
      if (gs.coins >= cost) gs.setServer(cfg, cost, role);
    }
  }
}

async function runLevel(maxTicks = 1800) {
  const coinsAtStart = Math.round(gs.coins);
  g.stopGameLoop();
  gs.appLive = true;
  if (g.tutorial.active) g.tutorial.finish();
  let t = 0;
  for (; t < maxTicks && !gs.levelCompleted; t++) {
    act();
    g.gameTick();
    if (t % 100 === 0) await new Promise(r => setTimeout(r, 0));
  }
  g.stopGameLoop();
  const ev = evaluateChallenges(gs);
  return {
    level: gs.level, minutes: Math.round(t * 2 / 60), done: gs.levelCompleted, users: gs.users,
    pending: ev.results.filter(r => !r.done).map(r => `${r.id}: ${r.display || `${Math.round(r.value)}/${r.target}`}`),
    bottleneck: `${gs.serverStatus.bottleneckRole}.${gs.serverStatus.bottleneck}`, latency: gs.metrics.latency,
    profit: gs.getEconomySummary().profit, coinsAtStart,
    funding: gs.fundingHistory.at(-1)?.amount, coinsEnd: Math.round(gs.coins)
  };
}

const results = [await runLevel()];
while (gs.levelCompleted && g.nextPlayableLevel()) {
  g.startNextLevel();
  results.push(await runLevel());
}
console.table(results);
