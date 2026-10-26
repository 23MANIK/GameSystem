/**
 * balance.mjs — the level balance check as a function (used by
 * tools/balance-levels.mjs, tools/check-pack.mjs and the DesignGame generator).
 *
 * For each level it builds the cheapest system that fits the level's audience
 * (or 15% over the user target), first WITH the level's new machine and
 * then WITHOUT it. A good level:
 *   - "with" reaches the target at a price the player can afford by then
 *   - "without" falls short (or breaks latency / disk / errors)
 *
 * It upgrades the part that runs out first, one step at a time, like a player
 * following the game's hints. Numbers are a guide: always play-test too.
 */

import { setActiveProduct, scaleOutRule } from '../../js/products/registry.js';
import { LEVELS } from '../../js/data/levels.js';
import { simulateSystem } from '../../js/game/SystemSimulator.js';
import * as SP from '../../js/data/serverParts.js';
import { ROLES, rolesForLevel } from '../../js/data/roles.js';
import { fixesForLevel } from '../../js/data/codeFixes.js';
import { AGENT_DEFAULTS } from '../../js/game/AgentSim.js';



export const PARAM_KEYS = ['readsPerUser', 'writesPerUser', 'pageViewsPerUser', 'pageKB', 'botShare', 'botKind', 'spamPerUser',
  'globalShare', 'distanceMs', 'dbReadCost', 'readKind', 'cacheHitRate', 'edgeHitRate', 'clickTracking', 'keepRecords', 'appCallCost', 'shardIdClash', 'fanoutPerWrite', 'celebrityShare', 'celebrityMult',
  'readKB', 'writeKB', 'recordSpace', 'blobSpaceMult', 'bigFileShare', 'dedupShare', 'updateShare', 'devicesPerUser',
  'pollPerDevice', 'listReadsPerUser', 'conflictShare', 'publicShare', 'unverifiedShare', 'browsePerUser',
  'clashShare', 'searchPerUser', 'searchCacheHit', 'rushPerUser', 'reportPerUser', 'reportCost', 'dupShare', 'hotShare', 'lossShare',
  ...Object.keys(AGENT_DEFAULTS)];

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

function cost(m, appCount, dbCount, s) {
  let price = 0;
  let run = Math.round(s?.tokenBillPerMin || 0);   // usage bills (an AI model's tokens)
  for (const [r, c] of Object.entries(m)) {
    const n = r === 'app' ? appCount : r === 'db' ? dbCount : 1;
    price += SP.serverCost(c) * n;
    run += SP.runningCostPerMinute(c) * n * (ROLES[r]?.costMult ?? 1);
  }
  return { price, run };
}

/** Try 1..max app servers / shards; keep the cheapest that works. */
function best(L, roles, base) {
  const appRule = scaleOutRule('app', L.level);
  const dbRule = scaleOutRule('db', L.level);
  const appMax = appRule && roles.includes(appRule.needs || 'app') ? ROLES.app.maxCount : 1;
  const dbMax = dbRule && roles.includes('db') ? ROLES.db.maxCount : 1;
  let pick = null;
  for (let a = 1; a <= appMax; a++) {
    for (let d = 1; d <= dbMax; d++) {
      const res = solve(L, roles, { ...base, appCount: a, dbCount: d });
      const c = cost(res.m, a, d, res.s);
      // Cheapest that works; if none works, the one that gets closest (so the
      // report names the real limit, not the cheapest broken setup)
      const score = res.ok ? c.run : 1e12 - Math.min(res.s.userLimit, 1e8) * 1e3 + c.run;
      if (!pick || score < pick.score) pick = { ...res, ...c, apps: a, shards: d, score };
    }
  }
  return pick;
}

/** AI agents: wrong answers, unsafe actions, slow research jobs, a bill bigger than the income. */
function agentFlags(s, r, L, revenue) {
  return [
    s.answerQuality != null && s.answerQuality < 0.9 ? `answers ${Math.round(s.answerQuality * 100)}%` : '',
    s.badActionsPerSec > 0 ? 'UNSAFE' : '', s.attacksPerSec > 0 && !s.attacksBlockedPerSec ? 'TRICKED' : '',
    s.researchSec > 45 ? `SLOW JOBS ${Math.round(s.researchSec)}s` : '',
    s.answerQuality != null && r.run > revenue * 0.8 ? 'LOSS' : '',
    L.billTarget && s.billPer1k > L.billTarget ? `COSTLY ${s.billPer1k}/1k` : ''
  ].filter(Boolean);
}

function line(label, r, L) {
  if (!r) return `  ${label}: –`;
  const s = r.s;
  const revenue = Math.round(L.userTarget / 100 * (L.coinRate || 25) * 30);
  const flags = [s.diskFull ? 'DISK FULL' : '', s.collisionShare ? 'CODE CLASHES' : '', s.clashShare ? 'DOUBLE BOOKINGS' : '', s.clickAccuracy != null && s.clickAccuracy < 0.95 ? `clicks ${Math.round(s.clickAccuracy * 100)}%` : '', ...agentFlags(s, r, L, revenue)].filter(Boolean).join(' ');
  return `  ${label.padEnd(12)} ${r.ok ? 'OK  ' : 'FAIL'} limit ${String(s.userLimit).padStart(6)}  runs out: ${(s.bottleneckRole + '.' + s.bottleneck).padEnd(14)} latency ${String(s.latency).padStart(4)} ms  `
    + `buy ${String(r.price).padStart(6)}  run ${String(r.run).padStart(5)}/min  revenue ~${revenue}/min  apps ${r.apps} shards ${r.shards} ${flags}`;
}


function row(label, r, L) {
  if (!r) return null;
  const s = r.s;
  return {
    label, ok: r.ok, limit: s.userLimit, runsOut: `${s.bottleneckRole}.${s.bottleneck}`, latency: s.latency,
    price: r.price, run: r.run, revenue: Math.round(L.userTarget / 100 * (L.coinRate || 25) * 30),
    apps: r.apps, shards: r.shards, diskFull: Boolean(s.diskFull), clashes: Boolean(s.collisionShare),
    clickAccuracy: s.clickAccuracy ?? null,
    // The level still "breaks" without this piece
    broken: !r.ok || Boolean(s.diskFull) || Boolean(s.collisionShare) || Boolean(s.clashShare) || (s.clickAccuracy != null && s.clickAccuracy < 0.95)
      || agentFlags(s, r, L, Math.round(L.userTarget / 100 * (L.coinRate || 25) * 30)).length > 0,
    text: line(label, r, L)
  };
}

/**
 * Balance every level of a product (it becomes the active product).
 * Returns { productId, levels: [{ level, name, target, stored, newRole, with, without, noFix: [] }], text }.
 */
export function balance(productId) {
  const pack = setActiveProduct(productId);
  const out = [];
  const text = [`\n${productId}: ${LEVELS.length} levels\n`];
  // Records stored by each level: carried over + ~4 minutes of writes at the target
  let entries = 0;
  for (const L of LEVELS) {
    const roles = rolesForLevel(L.level);
    const newRole = pack.levelRole?.[L.level];
    const fixes = Object.fromEntries(fixesForLevel(L.level).filter(f => !f.toggle).map(f => [f.id, true]));
    const p = params(L);
    const writes = (p.writesPerUser ?? 0.004) + (p.botKind === 'write' ? (p.spamPerUser || 0) * 0.05 : 0);
    entries += L.userTarget * writes * 240;
    const stored = fixes.expiry || fixes.archive ? Math.min(entries, p.keepRecords || 2000) : entries;
    const base = { entries: stored, fixes, target: L.userTarget };

    const lv = { level: L.level, name: L.name, target: L.userTarget, stored: Math.round(stored), newRole: newRole || null, noFix: [] };
    text.push(`Level ${L.level} · ${L.name} — target ${L.userTarget} users, ~${Math.round(stored).toLocaleString()} records, new: ${newRole || '–'}`);
    lv.with = row('with', best(L, roles, base), L);
    text.push(lv.with.text);
    if (newRole && newRole !== 'app') {
      lv.without = row(`without ${newRole}`, best(L, roles.filter(r => r !== newRole), base), L);
      text.push(lv.without.text);
    }
    // Each code fix of this level, taken away
    for (const f of fixesForLevel(L.level).filter(fx => fx.unlockLevel === L.level && !fx.toggle)) {
      const without = { ...fixes };
      delete without[f.id];
      const r = row(`no ${f.id}`, best(L, roles, { ...base, fixes: without }), L);
      lv.noFix.push({ fix: f.id, ...r });
      text.push(r.text);
    }
    text.push('');
    out.push(lv);
  }
  return { productId, levels: out, text: text.join('\n') };
}
