#!/usr/bin/env node
/**
 * balance-levels.mjs — check that every level of a product is beatable and
 * actually needs what it teaches.
 *
 *   node tools/balance-levels.mjs url_shortener
 *   node tools/balance-levels.mjs --pack game.json   (a data pack)
 *
 * For each level it builds the cheapest system that fits the level's audience
 * (or 15% over the user target), first WITH the level's new machine and
 * then WITHOUT it, and prints both. A good level:
 *   - "with" reaches the target at a price the player can afford by then
 *   - "without" falls short (or breaks latency / disk / errors)
 *
 * It upgrades the part that runs out first, one step at a time, like a player
 * following the game's hints. Numbers are a guide: always play-test too.
 */

const root = new URL('../js/', import.meta.url).href;
const registry = await import(root + 'products/registry.js');
const { productFromArgs } = await import('./designgame/pack-arg.mjs');
const productId = await productFromArgs(process.argv.slice(2));
if (!registry.hasPack(productId)) {
  console.error(`Unknown product "${productId}". Known: ${Object.keys(registry.PACKS).join(', ')}`);
  process.exit(1);
}
const pack = registry.setActiveProduct(productId);
const { LEVELS } = await import(root + 'data/levels.js');
const { simulateSystem } = await import(root + 'game/SystemSimulator.js');
const SP = await import(root + 'data/serverParts.js');
const { ROLES, rolesForLevel } = await import(root + 'data/roles.js');
const { CODE_FIXES, fixesForLevel } = await import(root + 'data/codeFixes.js');

const PARAM_KEYS = ['readsPerUser', 'writesPerUser', 'pageViewsPerUser', 'pageKB', 'botShare', 'botKind', 'spamPerUser',
  'globalShare', 'distanceMs', 'dbReadCost', 'readKind', 'cacheHitRate', 'edgeHitRate', 'clickTracking', 'keepRecords', 'appCallCost', 'shardIdClash', 'fanoutPerWrite', 'celebrityShare', 'celebrityMult',
  'readKB', 'writeKB', 'recordSpace', 'blobSpaceMult', 'bigFileShare', 'dedupShare', 'updateShare', 'devicesPerUser',
  'pollPerDevice', 'listReadsPerUser', 'conflictShare', 'publicShare', 'unverifiedShare', 'browsePerUser'];

function params(L) {
  const p = {};
  for (const k of PARAM_KEYS) if (L[k] !== undefined) p[k] = L[k];
  return p;
}

function cheapest() {
  return Object.fromEntries(SP.PART_ORDER.map(id => [id, SP.SERVER_PARTS[id].options[0].id]));
}

/** Greedy: upgrade whatever runs out first (or is busiest) until the target fits. */
function solve(L, roles, { appCount = 1, dbCount = 1, entries, fixes, target }) {
  // Room for everyone who will come (the level's audience), or 15% over the target
  const need = Math.max(target * 1.15, L.audience || 0);
  const m = {};
  for (const r of roles) m[r] = cheapest();
  const input = () => ({ machines: m, appCount, dbCount, users: target, entries, fixes, params: params(L) });
  let s = simulateSystem(input());
  for (let i = 0; i < 80; i++) {
    const fits = s.userLimit >= need && s.peak < 0.8 && !s.diskFull;
    if (fits) return { m, s, ok: true };
    // Disk full: biggest disk on the data machine
    let role = s.bottleneckRole;
    let part = s.bottleneck;
    if (s.diskFull) { role = s.space.role; part = 'storage'; }
    else if (s.userLimit >= need) { role = s.busiestRole; part = s.busiest; }
    const list = SP.optionsForLevel(part, L.level);
    const idx = list.findIndex(o => o.id === m[role][part]);
    let next = list[idx + 1];
    if (part === 'storage' && role === s.space.role) {
      // The data disk must stay big enough (with room to grow) AND fast enough
      const now = SP.getOption('storage', m[role].storage);
      // Space scales with the option (blob storage and shards multiply it)
      const perSpace = s.space.capacity / Math.max(1, now.space);
      const needSpace = s.space.used * 1.25;
      next = list
        .filter(o => o.space * perSpace >= needSpace && (s.diskFull ? true : o.capacity > now.capacity))
        .sort((x, y) => x.cost - y.cost)[0];
    }
    if (!next) return { m, s, ok: false };
    m[role][part] = next.id;
    s = simulateSystem(input());
  }
  return { m, s, ok: false };
}

function cost(m, appCount, dbCount) {
  let price = 0;
  let run = 0;
  for (const [r, c] of Object.entries(m)) {
    const n = r === 'app' ? appCount : r === 'db' ? dbCount : 1;
    price += SP.serverCost(c) * n;
    run += SP.runningCostPerMinute(c) * n * (ROLES[r]?.costMult ?? 1);
  }
  return { price, run };
}

/** Try 1..max app servers / shards; keep the cheapest that works. */
function best(L, roles, base) {
  const appRule = registry.scaleOutRule('app', L.level);
  const dbRule = registry.scaleOutRule('db', L.level);
  const appMax = appRule && roles.includes(appRule.needs || 'app') ? ROLES.app.maxCount : 1;
  const dbMax = dbRule && roles.includes('db') ? ROLES.db.maxCount : 1;
  let pick = null;
  for (let a = 1; a <= appMax; a++) {
    for (let d = 1; d <= dbMax; d++) {
      const res = solve(L, roles, { ...base, appCount: a, dbCount: d });
      const c = cost(res.m, a, d);
      const score = (res.ok ? 0 : 1e9) + c.run;
      if (!pick || score < pick.score) pick = { ...res, ...c, apps: a, shards: d, score };
    }
  }
  return pick;
}

function line(label, r, L) {
  if (!r) return `  ${label}: –`;
  const s = r.s;
  const revenue = Math.round(L.userTarget / 100 * (L.coinRate || 25) * 30);
  const flags = [s.diskFull ? 'DISK FULL' : '', s.collisionShare ? 'CODE CLASHES' : '', s.clickAccuracy != null && s.clickAccuracy < 0.95 ? `clicks ${Math.round(s.clickAccuracy * 100)}%` : ''].filter(Boolean).join(' ');
  return `  ${label.padEnd(12)} ${r.ok ? 'OK  ' : 'FAIL'} limit ${String(s.userLimit).padStart(6)}  runs out: ${(s.bottleneckRole + '.' + s.bottleneck).padEnd(14)} latency ${String(s.latency).padStart(4)} ms  `
    + `buy ${String(r.price).padStart(6)}  run ${String(r.run).padStart(5)}/min  revenue ~${revenue}/min  apps ${r.apps} shards ${r.shards} ${flags}`;
}

// Records stored by each level: carried over + ~4 minutes of writes at the target
let entries = 0;
console.log(`\n${productId}: ${LEVELS.length} levels\n`);
for (const L of LEVELS) {
  const roles = rolesForLevel(L.level);
  const newRole = pack.levelRole?.[L.level];
  const fixes = Object.fromEntries(fixesForLevel(L.level).filter(f => !f.toggle).map(f => [f.id, true]));
  const p = params(L);
  const writes = (p.writesPerUser ?? 0.004) + (p.botKind === 'write' ? (p.spamPerUser || 0) * 0.05 : 0);
  entries += L.userTarget * writes * 240;
  const stored = fixes.expiry || fixes.archive ? Math.min(entries, p.keepRecords || 2000) : entries;
  const base = { entries: stored, fixes, target: L.userTarget };

  console.log(`Level ${L.level} · ${L.name} — target ${L.userTarget} users, ~${Math.round(stored).toLocaleString()} records, new: ${newRole || '–'}`);
  console.log(line('with', best(L, roles, base), L));
  if (newRole && newRole !== 'app') {
    console.log(line(`without ${newRole}`, best(L, roles.filter(r => r !== newRole), base), L));
  }
  // Each code fix of this level, taken away
  for (const f of fixesForLevel(L.level).filter(fx => fx.unlockLevel === L.level && !fx.toggle)) {
    const without = { ...fixes };
    delete without[f.id];
    console.log(line(`no ${f.id}`, best(L, roles, { ...base, fixes: without }), L));
  }
  console.log('');
}
