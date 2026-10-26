// Every design pack: levels, goals and tutorial steps are complete and safe to show.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, packIds, loadModules } from '../helpers/harness.mjs';
import { knownBugTest } from '../helpers/known-bugs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const m = await loadModules();
const ids = await packIds();

// Element ids the page has (index.html and the top bar), for tutorial highlights
const pageIds = new Set();
for (const f of ['index.html', 'js/ui/HUD.js']) {
  for (const x of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/id="([a-z0-9-]+)"/g)) pageIds.add(x[1]);
}
// Events the game can emit (directly, or picked in a ternary before emit())
const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const emitted = new Set();
for (const f of walk(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!/emit\(|event =|const event|\? '/.test(line)) continue;
    for (const x of line.matchAll(/'([a-z][A-Za-z]+)'/g)) emitted.add(x[1]);
  }
}
const bad = s => typeof s !== 'string' || !s.trim() || /undefined|NaN|\[object Object\]/.test(s);

for (const id of ids) {
  test(`${id}: levels have names, stories, targets and enough starting coins`, async () => {
    const game = await newGame(id);
    const L1 = game.LEVELS[0];
    assert.ok(L1.startingCoins >= m.parts.serverCost(m.parts.cheapestServer()), `Level 1 starts with ${L1.startingCoins} coins, less than the cheapest server`);
    for (const L of game.playableLevels()) {
      for (const k of ['name', 'story', 'completionMessage']) assert.ok(!bad(L[k]), `level ${L.level}: ${k} is "${L[k]}"`);
      assert.ok(L.userTarget > 0, `level ${L.level}: userTarget ${L.userTarget}`);
    }
  });

  test(`${id}: every tutorial step renders text, highlights a real element and waits for a real event`, async () => {
    const game = await newGame(id);
    for (const L of game.playableLevels()) {
      game.gs.level = L.level;
      game.gs.recalculateMetrics();
      const steps = m.tutorialMod.getSteps(L.level);
      assert.ok(steps.length > 0, `level ${L.level} has no tutorial`);
      const stepIds = steps.map(s => s.id);
      assert.equal(new Set(stepIds).size, stepIds.length, `level ${L.level}: duplicate step ids ${stepIds}`);
      for (const s of steps) {
        const where = `level ${L.level} step "${s.id}"`;
        assert.ok(!bad(s.text(game.gs, null)), `${where}: text is "${s.text(game.gs, null)}"`);
        if (s.highlight) assert.ok(pageIds.has(s.highlight.replace(/^#/, '')), `${where}: highlight ${s.highlight} is not on the page`);
        for (const e of [].concat(s.advanceOn || [])) assert.ok(emitted.has(e), `${where}: waits for "${e}", which the game never sends`);
        assert.ok(s.button || s.advanceOn, `${where}: has neither a button nor an event, so the player is stuck on it`);
      }
    }
  });

  test(`${id}: every goal has a label, an icon and progress that works from a fresh start`, async () => {
    const game = await newGame(id);
    for (const L of game.playableLevels()) {
      game.gs.level = L.level;
      game.gs.recalculateMetrics();
      const goals = m.challenges.getChallenges(L.level);
      const goalIds = goals.map(g => g.id);
      assert.equal(new Set(goalIds).size, goalIds.length, `level ${L.level}: duplicate goal ids ${goalIds}`);
      for (const g of goals) {
        assert.ok(!bad(g.label) && g.icon, `level ${L.level} goal ${g.id}: label or icon missing`);
        const p = g.progress(game.gs);
        assert.ok(Number.isFinite(p.value) && Number.isFinite(p.target), `level ${L.level} goal ${g.id}: progress ${JSON.stringify(p)}`);
      }
      const ev = m.challenges.evaluateChallenges(game.gs);
      assert.ok(!ev.allDone, `level ${L.level}: every goal is already done before playing`);
    }
  });

  knownBugTest(test, 'pending-goal-green-check', `${id}: no goal uses a check mark as its icon (it would look done while pending)`, async () => {
    const game = await newGame(id);
    const offenders = [];
    for (const L of game.playableLevels()) {
      for (const g of m.challenges.getChallenges(L.level)) if (/^[✅✔☑]/.test(g.icon || '')) offenders.push(`L${L.level} ${g.id} ${g.icon}`);
    }
    assert.deepEqual(offenders, [], `goals with a check-mark icon: ${offenders.join(', ')}`);
  });
}
