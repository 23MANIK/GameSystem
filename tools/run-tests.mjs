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
  const files = [...walk(path.join(ROOT, 'js')), ...walk(path.join(ROOT, 'tools')), path.join(ROOT, 'deploy/middleware.js'), path.join(ROOT, 'deploy/api/presence.js'), path.join(ROOT, 'deploy/api/feedback.js'), path.join(ROOT, 'deploy/api/designgame.js')]
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

// ─── 4b. Buildings: 3D gallery levels and upgrades ───
await test('buildings: level follows parts, each upgrade grows exactly one level', async () => {
  registry.setActiveProduct('guestbook');
  const { buildingLevel, nextLevelUpgrade } = await imp('js/game/BuildingLevels.js');
  const { cheapestServer, upgradeCost } = await imp('js/data/serverParts.js');
  assert(buildingLevel(cheapestServer()) === 1, 'cheapest server should be Lv 1');
  assert(buildingLevel({ cpu: 'cpu_8', ram: 'ram_8', storage: 'disk_nvme_xl', network: 'net_10g' }) === 4, 'biggest parts should be Lv 4');
  for (const [gameLevel, maxLv] of [[1, 3], [5, 4]]) {
    const gs = { level: gameLevel, codeFixes: {}, machines: { app: cheapestServer() }, getServerConfig(r) { return this.machines[r]; }, machineCount: () => 2 };
    let lv = 1;
    for (;;) {
      const up = nextLevelUpgrade(gs, 'app');
      if (up.blocked) break;
      assert(up.level === lv + 1 && buildingLevel(up.config) === lv + 1, `game Lv ${gameLevel}: Lv ${lv} → ${up.level}`);
      assert(up.cost === upgradeCost(gs.machines.app, up.config) * 2, 'upgrade is paid for every app server');
      gs.machines.app = up.config;
      lv = up.level;
    }
    assert(lv === maxLv, `game Lv ${gameLevel} should reach building Lv ${maxLv}, got ${lv}`);
  }
});

await test('buildings: every type, level and state draws a valid SVG', async () => {
  const { isoSVG } = await imp('js/components/IsoBuildings.js');
  for (const type of ['server', 'lb', 'db', 'cache', 'queue', 'cdn', 'firewall', 'broker']) {
    for (const lv of [1, 2, 3, 4]) {
      for (const state of ['idle', 'processing', 'heavy', 'scaling', 'failed']) {
        const svg = isoSVG(type, lv, state);
        assert(svg.startsWith('<svg') && !/NaN|undefined/.test(svg), `${type} Lv ${lv} ${state}`);
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

// ─── 5b. Headless play-test: a bot finishes every level ───
for (const id of Object.keys(registry.PACKS)) {
  await test(`${id}: headless play-test finishes every level`, () => {
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'tools/playtest-headless.mjs'), id], { encoding: 'utf8' });
    } catch (e) {
      throw new Error((e.stdout || e.message).trim().split('\n').filter(l => /STUCK|pending|FAIL/.test(l)).join(' | '));
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

// ─── 9. Data packs (generated games) ───
const dp = await imp('js/products/dataPack.js');
const usJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/designgame/url-shortener.pack.json'), 'utf8'));

await test('data pack: the URL shortener as JSON is valid', () => {
  const problems = dp.validateDataPack(usJson);
  assert(!problems.length, problems.slice(0, 5).join('; '));
  const pack = dp.compileDataPack(usJson);
  assert(Object.keys(pack.challenges).length === 8 && pack.steps[7].length > 3, 'levels, goals or steps missing');
});
await test('data pack: plays exactly like the hand-made URL shortener', () => {
  const play = args => JSON.parse(execFileSync(process.execPath, [path.join(ROOT, 'tools/playtest-headless.mjs'), ...args, '--json'], { encoding: 'utf8' }));
  const a = play(['url_shortener']);
  const b = play(['--pack', path.join(ROOT, 'tools/designgame/url-shortener.pack.json')]);
  assert(a.passed && b.passed, 'a play-test failed');
  const pick = r => [r.level, r.done, r.minutes, r.users, r.coinsEnd, r.apps, r.shards].join(',');
  assert(a.results.map(pick).join('|') === b.results.map(pick).join('|'), 'data pack plays differently');
});
await test('data pack: the in-process gate (balance + play-test) passes it', async () => {
  const { registerPack } = await imp('js/products/registry.js');
  const { checkGame } = await imp('tools/designgame/checkGame.mjs');
  registerPack(dp.compileDataPack(usJson));
  const r = checkGame(usJson.id);
  assert(r.passed, r.errors.join('; '));
  assert(r.play.results.length === 8 && r.balance.length === 8, 'missing levels in the report');
});
await test('generator: the whole pipeline runs with a stand-in model, and repairs a broken outline', async () => {
  const gen = await imp('tools/designgame/generate.mjs');
  const { splitPack } = await imp('tools/designgame/split.mjs');
  const { outline: good, details } = splitPack(usJson);
  const broken = JSON.parse(JSON.stringify(good));
  broken.goals[2][1] = { type: 'teleport' };
  const plans = [broken, good];
  let detailCalls = 0;
  const msg = (text, extra = {}) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 500 }, ...extra });
  const json = x => msg('```json\n' + JSON.stringify(x) + '\n```');
  const client = {
    messages: { create: async () => msg(JSON.stringify({ ok: true, reason: 'ok', name: 'URL Shortener', likeWhat: 'like bit.ly', icon: '🔗', slug: 'url shortener!' })) },
    beta: { messages: { stream: req => ({ finalMessage: async () => {
      if (req.tools) return msg('', { content: [{ type: 'web_search_tool_result', content: [{ url: 'https://example.com/a', title: 'A' }] }, { type: 'text', text: 'Notes '.repeat(100) + ' https://example.com/a' }] });
      if (req.system[0].text.includes('OUTLINE')) return json(plans.shift());
      detailCalls += 1;
      const n = Number(req.messages[0].content.match(/details for level (\d+)/)[1]);
      return json(details.find(d => d.level === n));
    } }) } }
  };
  const stages = [];
  const out = await gen.generateGame({ prompt: 'a url shortener' }, { client, onStep: j => stages.push(j.stage) });
  assert(out.stage === 'done', `not done: ${out.error?.message || out.result?.problems.join('; ')}`);
  assert(out.round === 1 && stages.includes('repair') && stages.includes('redetail'), `repair round did not run: ${stages.join(' → ')}`);
  assert(JSON.parse(JSON.stringify(out)).data.id === out.data.id, 'job is not plain JSON');
  assert(detailCalls === 9, `expected 8 + 1 level rewrites, got ${detailCalls}`);
  assert(out.data.id === 'dg_url_shortener', `id ${out.data.id}`);
  assert(out.data.meta.sources.length && out.usage.dollars > 0, 'sources or usage missing');
});
await test('generator: outline and details split and merge back to the same game', async () => {
  const { splitPack, mergePack } = await imp('tools/designgame/split.mjs');
  const { outline, details } = splitPack(usJson);
  const sorted = x => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
  assert(sorted(mergePack(outline, details)) === sorted(usJson), 'round trip changed the game');
  assert(!JSON.stringify(outline).includes('"hint"') && !outline.tutorial, 'outline still has words');
});
await test('data pack: rejects unknown machines, fixes, goals and fields', () => {
  const bad = JSON.parse(JSON.stringify(usJson));
  bad.roles.teleporter = { unlockLevel: 2 };
  bad.fixes.magic = 3;
  bad.goals[1].push({ type: 'eval', hint: 'x' });
  bad.levels[0].onTick = 'alert(1)';
  bad.tutorial[2][0].highlight = 'body';
  const p = dp.validateDataPack(bad).join(' | ');
  for (const w of ['roles.teleporter', 'fixes.magic', 'unknown goal type', 'levels[0].onTick', 'highlight']) assert(p.includes(w), `missed: ${w}`);
  let threw = false;
  try { dp.compileDataPack(bad); } catch (e) { threw = e instanceof dp.DataPackError; }
  assert(threw, 'compile accepted a bad pack');
});
await test('data pack: text keeps simple formatting and drops HTML', () => {
  assert(dp.cleanText('<strong>Bold</strong> and <em>soft</em>') === '<strong>Bold</strong> and <em>soft</em>', 'formatting lost');
  const evil = dp.cleanText('<img src=x onerror=alert(1)><script>x</script><strong onclick="x">a</strong>');
  assert(!/</.test(evil.replace(/<\/?(strong|em|code|b|i)>|<br>/g, '')), `unsafe html kept: ${evil}`);
  const bad = JSON.parse(JSON.stringify(usJson));
  bad.levels[0].story = 'Hi <script>alert(1)</script>';
  assert(!dp.compileDataPack(bad).levels[0].story.includes('<script'), 'story not cleaned');
});

// ─── 10. DesignGame API ───
await test('designgame api: server code and notes are not served as files', async () => {
  for (const p of ['/tools/designgame/generate.mjs', '/docs/designgame/data-pack-format.md', '/package.json']) {
    const r = mw.default(req(p, '7.7.7.7'));
    assert(r && r.status === 404, `${p} is served`);
  }
  assert(!mw.default(req('/js/main.js', '7.7.7.8')), 'game files blocked');
});
await test('designgame api: passcode, daily cap, a whole job, publish and list', async () => {
  const svc = await imp('tools/designgame/service.mjs');
  const { splitPack } = await imp('tools/designgame/split.mjs');
  const { outline, details } = splitPack(usJson);
  const msg = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } });
  const json = x => msg('```json\n' + JSON.stringify(x) + '\n```');
  const client = {
    messages: { create: async () => msg(JSON.stringify({ ok: true, reason: 'ok', name: 'URL Shortener', likeWhat: 'like bit.ly', icon: '🔗', slug: 'url_shortener' })) },
    beta: { messages: { stream: r => ({ finalMessage: async () => (r.tools ? msg('Research notes. '.repeat(40))
      : r.system[0].text.includes('OUTLINE') ? json(outline)
        : json(details.find(d => d.level === Number(r.messages[0].content.match(/details for level (\d+)/)[1])))) }) } }
  };
  const store = svc.memoryStore();
  const env = { DESIGNGAME_PASSCODE: 'open sesame', DESIGNGAME_DAILY_MAX: '2', ANTHROPIC_API_KEY: 'x' };
  const call = (method, q, b, ip = '5.5.5.5') => svc.handleAction(method, q, b, { store, env, ip, client });

  assert((await call('POST', {}, { action: 'auth', passcode: 'nope' })).status === 401, 'wrong passcode accepted');
  for (let i = 0; i < 5; i++) await call('POST', {}, { action: 'auth', passcode: 'nope' }, '6.6.6.6');
  assert((await call('POST', {}, { action: 'auth', passcode: 'open sesame' }, '6.6.6.6')).status === 429, 'passcode guessing not capped');
  assert((await call('POST', {}, { action: 'auth', passcode: 'open sesame' })).status === 200, 'right passcode refused');
  assert((await svc.handleAction('POST', {}, { action: 'auth', passcode: 'x' }, { store, env: {}, client })).status === 503, 'works without a passcode set');

  const started = await call('POST', {}, { action: 'start', passcode: 'open sesame', input: { prompt: 'a url shortener', levels: 8 } });
  assert(started.status === 200 && /^[a-f0-9]{16}$/.test(started.body.jobId), 'start failed');
  let view;
  for (let i = 0; i < 12; i++) {
    view = (await call('POST', {}, { action: 'step', passcode: 'open sesame', jobId: started.body.jobId })).body;
    // The job is saved as JSON between steps, like on the server
    if (view.done) break;
  }
  assert(view.stage === 'done' && /^dg_url_shortener_[a-f0-9]{4}$/.test(view.gameId), `job ended in ${view.stage}: ${view.error?.message}`);
  assert(!('messages' in view) && view.log.length >= 4, 'job view leaks internals or has no log');
  const game = await call('GET', { action: 'game', id: view.gameId });
  assert(game.status === 200 && game.body.levels.length === 8, 'game not stored');
  assert((await call('GET', { action: 'list' })).body.games.length === 0, 'unpublished game is listed');
  assert((await call('POST', {}, { action: 'publish', passcode: 'open sesame', id: view.gameId, public: true })).status === 200, 'publish failed');
  const list = (await call('GET', { action: 'list' })).body.games;
  assert(list.length === 1 && list[0].name === 'URL Shortener' && list[0].levels.length === 8, 'published game missing from the list');

  await call('POST', {}, { action: 'start', passcode: 'open sesame', input: { prompt: 'chat app' } });
  const third = await call('POST', {}, { action: 'start', passcode: 'open sesame', input: { prompt: 'video' } });
  assert(third.status === 429, 'daily cap not enforced');
  assert((await call('GET', { action: 'game', id: '../etc' })).status === 400, 'bad id accepted');
});

// ─── Report ───
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    → ${r.err}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
