#!/usr/bin/env node
/**
 * run-tests.mjs — the checks that must pass before anything goes to production.
 *
 *   node tools/run-tests.mjs
 *
 * Exit code 0 = all passed, 1 = something failed (the deploy must stop).
 * Covers: syntax, every file the page loads, product packs, the simulator,
 * level balance, and the edge rate limiter. The in-browser playthrough of
 * every level is a separate step (see .claude/skills/deploy-game).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => results.push({ name, ok: true }))
    .catch(err => results.push({ name, ok: false, err: err?.message || String(err) }));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const walk = d => fs.readdirSync(d).flatMap(f => {
  const p = path.join(d, f);
  return fs.statSync(p).isDirectory() ? walk(p) : [p];
});
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);

// ─── 1. Syntax ───
await test('every JS file parses', () => {
  const files = [...walk(path.join(ROOT, 'js')), ...walk(path.join(ROOT, 'tools')), path.join(ROOT, 'deploy/middleware.js'), path.join(ROOT, 'deploy/api/presence.js'), path.join(ROOT, 'deploy/api/feedback.js')]
    .filter(f => /\.(m?js)$/.test(f));
  const bad = [];
  for (const f of files) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch { bad.push(path.relative(ROOT, f)); }
  }
  assert(!bad.length, `syntax errors in: ${bad.join(', ')}`);
});

// ─── 2. Everything the page loads exists ───
await test('index.html and every import resolve to real files', () => {
  const missing = [];
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+)"/g)) {
    if (!fs.existsSync(path.join(ROOT, m[1]))) missing.push(`index.html → ${m[1]}`);
  }
  for (const f of walk(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:import|from)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(f), m[1]))) missing.push(`${path.relative(ROOT, f)} → ${m[1]}`);
    }
  }
  assert(!missing.length, `missing: ${missing.join('; ')}`);
});

// ─── 3. Product packs ───
const registry = await imp('js/products/registry.js');
const { EXPLANATIONS } = await imp('js/data/explanations.js');
const { ROLES } = await imp('js/data/roles.js');
const { CODE_FIXES } = await imp('js/data/codeFixes.js');
const { PRODUCTS } = await imp('js/data/products.js');

for (const id of Object.keys(registry.PACKS)) {
  await test(`${id}: every level has goals, a tutorial and valid references`, async () => {
    const pack = registry.setActiveProduct(id);
    const { LEVELS } = await imp('js/data/levels.js');
    const { getChallenges } = await imp('js/game/Challenges.js');
    const { getSteps } = await imp('js/game/Tutorial.js');
    assert(LEVELS.length > 0 && LEVELS.length <= 20, `level count ${LEVELS.length}`);
    LEVELS.forEach((L, i) => {
      assert(L.level === i + 1, `level numbers out of order at ${i + 1}`);
      assert(L.name && L.story && L.completionMessage, `level ${L.level} is missing text`);
      const goals = getChallenges(L.level);
      assert(goals.length >= 2, `level ${L.level} has ${goals.length} goals`);
      for (const g of goals) {
        assert(typeof g.progress === 'function', `level ${L.level} goal ${g.id} has no progress()`);
        if (g.info) assert(EXPLANATIONS[g.info], `level ${L.level} goal ${g.id}: no explanation "${g.info}"`);
      }
      assert(getSteps(L.level).length > 0, `level ${L.level} has no tutorial steps`);
    });
    for (const role of Object.keys(pack.roles)) assert(ROLES[role], `unknown role ${role}`);
    for (const fix of Object.keys(pack.fixes)) assert(CODE_FIXES[fix], `unknown code fix ${fix}`);
    const listed = PRODUCTS.find(p => p.id === id);
    assert(listed?.playable, `${id} is not playable in the product picker`);
    assert(listed.levels.length === LEVELS.length, `${id}: picker lists ${listed.levels.length} levels, pack has ${LEVELS.length}`);
  });
}

// ─── 4. Simulator ───
await test('simulator: Guestbook Level 1 numbers have not changed', async () => {
  registry.setActiveProduct('guestbook');
  const { simulateSystem } = await imp('js/game/SystemSimulator.js');
  const s = simulateSystem({
    machines: { app: { cpu: 'cpu_2', ram: 'ram_2', storage: 'disk_ssd', network: 'net_100' } },
    users: 100, entries: 50, fixes: {}, params: { writesPerUser: 0.004 }
  });
  // Snapshot taken when this test was written: a change means game balance moved
  assert(s.userLimit === 109, `user limit ${s.userLimit} (expected 109)`);
  assert(s.bottleneck === 'ram', `bottleneck ${s.bottleneck} (expected ram)`);
});

await test('simulator: every level of every product computes without NaN', async () => {
  const { simulateSystem } = await imp('js/game/SystemSimulator.js');
  const cfg = { cpu: 'cpu_4', ram: 'ram_4', storage: 'disk_nvme', network: 'net_1000' };
  for (const id of Object.keys(registry.PACKS)) {
    registry.setActiveProduct(id);
    const { LEVELS } = await imp('js/data/levels.js');
    for (const L of LEVELS) {
      const machines = {};
      for (const r of Object.keys(registry.PACKS[id].roles)) if (registry.PACKS[id].roles[r].unlockLevel <= L.level) machines[r] = cfg;
      const s = simulateSystem({ machines, users: L.userTarget, entries: 1000, fixes: {}, params: { ...L } });
      for (const k of ['userLimit', 'latency', 'errorRate', 'peak']) {
        assert(Number.isFinite(s[k]), `${id} level ${L.level}: ${k} = ${s[k]}`);
      }
    }
  }
});

// ─── 5. Balance: every level reachable with its new piece ───
for (const id of Object.keys(registry.PACKS)) {
  await test(`${id}: every level is reachable (balance tool)`, () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools/balance-levels.mjs'), id], { encoding: 'utf8' });
    const levels = out.split('\nLevel ').slice(1);
    assert(levels.length > 0, 'balance tool printed no levels');
    for (const block of levels) {
      const target = Number(block.match(/target (\d+) users/)?.[1]);
      const withRow = block.split('\n').find(l => l.trim().startsWith('with '));
      const limit = Number(withRow?.match(/limit\s+(\d+)/)?.[1]);
      assert(limit >= target, `level ${block.split(' ')[0]}: best system fits ${limit} users, target ${target}`);
    }
  });
}

// ─── 6. Edge rate limiter ───
const mw = await imp('deploy/middleware.js');
const req = (p, ip = '1.2.3.4') => new Request(`https://example.com${p}`, { headers: { 'x-real-ip': ip } });

await test('rate limiter: normal play passes', () => {
  mw._reset();
  const t = 1_000_000;
  for (let i = 0; i < 5; i++) {
    assert(mw.check(req('/'), t + i * 2000) === null, `page load ${i + 1} was blocked`);
    for (let j = 0; j < 45; j++) assert(mw.check(req(`/js/f${j}.js`), t + i * 2000) === null, 'file blocked');
  }
});

await test('rate limiter: reloading in a loop gets the busy page', () => {
  mw._reset();
  const t = 2_000_000;
  let blocked = null;
  for (let i = 0; i <= mw.LIMITS.PAGE_LIMIT; i++) blocked = mw.check(req('/'), t + i * 50) || blocked;
  assert(blocked && blocked.page && blocked.reason === 'visitor', 'page flood was not blocked');
  assert(blocked.retryAfter >= 1 && blocked.retryAfter <= 60, `retryAfter ${blocked.retryAfter}`);
  // A different visitor is unaffected
  assert(mw.check(req('/', '9.9.9.9'), t + 2000) === null, 'another visitor was blocked');
  // After the window, the same visitor gets in again
  assert(mw.check(req('/'), t + 61_000) === null, 'visitor still blocked after the window');
});

await test('rate limiter: a site-wide flood trips the busy valve', () => {
  mw._reset();
  const t = 3_000_000;
  let blocked = null;
  for (let i = 0; i <= mw.LIMITS.GLOBAL_PAGES_PER_SEC; i++) blocked = mw.check(req('/', `10.0.0.${i}`), t) || blocked;
  assert(blocked && blocked.reason === 'busy', 'site-wide flood was not blocked');
});

await test('rate limiter: busy page and 429 responses are well-formed', async () => {
  mw._reset();
  const t = Date.now();
  for (let i = 0; i < mw.LIMITS.PAGE_LIMIT; i++) mw.check(req('/', '5.5.5.5'), t);
  const res = mw.default(req('/', '5.5.5.5'));
  assert(res && res.status === 429, `status ${res?.status}`);
  assert(Number(res.headers.get('Retry-After')) >= 1, 'no Retry-After header');
  const html = await res.text();
  assert(html.includes('The system is busy') && html.includes('location.reload'), 'busy page text missing');
  mw._reset();
  assert(mw.default(req('/', '6.6.6.6')) === undefined, 'normal request did not pass through');
});

await test('rate limiter: presence pings are capped per visitor', () => {
  mw._reset();
  const t = 4_000_000;
  for (let i = 0; i < mw.LIMITS.API_LIMIT; i++) assert(mw.check(req('/api/presence', '7.7.7.7'), t + i) === null, `ping ${i + 1} blocked`);
  const blocked = mw.check(req('/api/presence', '7.7.7.7'), t + 20);
  assert(blocked && blocked.reason === 'api' && !blocked.page, 'ping flood was not blocked');
});

// ─── 7. Live players counter ───
const pres = await imp('deploy/api/presence.js');

await test('presence: without Redis it says "not configured" (game hides the counter)', async () => {
  assert(pres.redisConfig({}) === null, 'config found with no env vars');
  const r = await pres.presence({ id: 'abcdef12', product: 'guestbook' }, { cfg: null });
  assert(r.configured === false && r.online === null, JSON.stringify(r));
  const a = pres.redisConfig({ KV_REST_API_URL: 'https://x.upstash.io/', KV_REST_API_TOKEN: 't' });
  const b = pres.redisConfig({ UPSTASH_REDIS_REST_URL: 'https://y.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'u' });
  assert(a?.url === 'https://x.upstash.io' && b?.token === 'u', 'both env var namings must work');
});

await test('presence: rejects bad pings', () => {
  assert(pres.parsePing({ id: 'x', product: 'guestbook' }) === null, 'short id accepted');
  assert(pres.parsePing({ id: 'ABC<script>', product: 'guestbook' }) === null, 'unsafe id accepted');
  assert(pres.parsePing({ id: 'abcdef12', product: 'nope' }).product === null, 'unknown product accepted');
});

await test('presence: counts sessions active in the last 90 s, per product', async () => {
  // A tiny fake Upstash that runs ZADD / ZCOUNT / ZREMRANGEBYSCORE in memory
  const sets = {};
  const fakeFetch = async (url, opts) => {
    assert(url.endsWith('/pipeline') && opts.headers.Authorization === 'Bearer tok', 'wrong Upstash call');
    const out = JSON.parse(opts.body).map(([cmd, key, a, b]) => {
      const z = (sets[key] ||= new Map());
      if (cmd === 'ZADD') { z.set(b, Number(a)); return { result: 1 }; }
      if (cmd === 'ZCOUNT') return { result: [...z.values()].filter(v => v >= Number(a)).length };
      if (cmd === 'ZREMRANGEBYSCORE') { for (const [m, v] of z) if (v <= Number(b)) z.delete(m); return { result: 0 }; }
      return { error: 'unknown ' + cmd };
    });
    return { ok: true, json: async () => out };
  };
  const cfg = { url: 'https://fake.upstash.io', token: 'tok' };
  const t = 10_000_000;
  await pres.presence({ id: 'aaaaaaaa', product: 'guestbook' }, { cfg, now: t, fetchImpl: fakeFetch });
  await pres.presence({ id: 'bbbbbbbb', product: 'cloud_drive' }, { cfg, now: t + 1000, fetchImpl: fakeFetch });
  let r = await pres.presence({ id: 'aaaaaaaa', product: 'guestbook' }, { cfg, now: t + 2000, fetchImpl: fakeFetch });
  assert(r.online === 2 && r.byProduct.guestbook === 1 && r.byProduct.cloud_drive === 1, JSON.stringify(r));
  // 2 minutes later, only the one who kept pinging counts
  r = await pres.presence({ id: 'aaaaaaaa', product: 'guestbook' }, { cfg, now: t + 121_000, fetchImpl: fakeFetch, random: () => 0 });
  assert(r.online === 1 && r.byProduct.cloud_drive === 0, JSON.stringify(r));
});


// ─── 8. Feedback ───
const fbm = await imp('deploy/api/feedback.js');
await test('feedback: validates input and traps bots', () => {
  assert(fbm.parseFeedback({ message: 'hi' }).error, 'too short accepted');
  assert(fbm.parseFeedback({ message: 'x'.repeat(1001) }).error, 'too long accepted');
  assert(fbm.parseFeedback({ message: 'great game', website: 'spam.com' }).spam, 'honeypot missed');
  assert(fbm.parseFeedback({ message: 'great game', name: 'n'.repeat(200) }).name.length === 80, 'name not trimmed');
});
await test('feedback: per-visitor, duplicate and site-wide limits', async () => {
  const t = 50_000_000_000;
  for (let i = 0; i < 3; i++) assert(await fbm.checkLimits('1.1.1.1', `msg ${i}`, { now: t + i }) === null, `send ${i + 1} blocked`);
  assert(await fbm.checkLimits('1.1.1.1', 'msg 4', { now: t + 9 }), '4th in an hour allowed');
  assert(await fbm.checkLimits('2.2.2.2', 'hello there', { now: t }) === null, 'other visitor blocked');
  assert(await fbm.checkLimits('2.2.2.2', 'Hello there', { now: t + 1 }), 'duplicate allowed');
  let blocked = null;
  for (let i = 0; i < 100 && !blocked; i++) blocked = await fbm.checkLimits(`9.9.${i}.1`, 'site cap test', { now: t + 5 });
  assert(blocked && /today/.test(blocked), 'site-wide daily cap missing');
});

// ─── Report ───
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    → ${r.err}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
