// Starting a level with the system carried over from the last one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, packIds } from '../helpers/harness.mjs';
import { knownBugTest } from '../helpers/known-bugs.mjs';

/** Play every level; return what each level looked like the moment it started. */
async function levelStarts(id) {
  const game = await newGame(id, { tutorial: false });
  const { gs } = game;
  const starts = [];
  for (;;) {
    const r = game.runLevel();
    if (!r.done) throw new Error(`${id}: bot got stuck on level ${gs.level}`);
    if (!game.nextLevel()) break;
    gs.recalculateMetrics();
    starts.push({ level: gs.level, users: Math.round(gs.users), limit: gs.serverStatus.userLimit, peak: gs.serverStatus.peak, errorRate: gs.serverStatus.errorRate ?? 0 });
  }
  return starts;
}

for (const id of await packIds()) {
  knownBugTest(test, 'level-starts-overloaded', `${id}: no level opens already overloaded by the users carried over`, async () => {
    const bad = (await levelStarts(id)).filter(s => s.users > s.limit || s.peak > 1);
    assert.deepEqual(bad, [], `levels that start overloaded: ${bad.map(s => `L${s.level} ${s.users} users, limit ${s.limit}, peak ${Math.round(s.peak * 100)}%`).join('; ')}`);
  });
}

knownBugTest(test, 'level-starts-overloaded', 'Ticket Booking Level 4 does not start overloaded', async (t) => {
  if (!(await packIds()).includes('ticketing')) return t.skip('Ticket Booking is not in this branch yet (PR #7 / #8)');
  const s = (await levelStarts('ticketing')).find(s => s.level === 4);
  assert.ok(s, 'no Level 4');
  assert.ok(s.users <= s.limit && s.peak <= 1, `Level 4 starts with ${s.users} users, limit ${s.limit}, peak ${Math.round(s.peak * 100)}%`);
});
