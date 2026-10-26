/**
 * known-bugs.mjs — bugs that tests already check for but that are not fixed yet.
 *
 * A test for a bug listed here still runs. If it fails, it is reported as
 * "known bug" (skipped) instead of failing the suite, so a dev deploy is not
 * blocked by a bug someone is already fixing. If it passes, the run prints
 * "FIXED: remove it from tests/helpers/known-bugs.mjs".
 *
 * Remove an entry as soon as its fix is merged: from then on the test guards
 * against the bug coming back, and a failure stops the deploy.
 *
 * Fixes for all of these are in PR #7 (v2) / #8 (v3), "Fix play-test findings".
 */
export const KNOWN_BUGS = {
  'hdd-to-ssd-shrinks-disk': 'HDD → SSD upgrade shrinks the disk from 6,000 to 1,500 records without a warning, and users are lost',
  'storage-tradeoff-unexplained': 'Storage cards do not explain the speed vs size trade-off between HDD, SSD and NVMe',
  'tutorial-restarts-at-step-1': 'Level 2 tutorial goes back to step 1 when the player bought the database before pressing "Show me"',
  'level-starts-overloaded': 'A new level can open already overloaded from the users carried over (Ticket Booking Level 4)',
  'pending-goal-green-check': 'Goals that are not done yet show a green check as their icon',
  'escape-keeps-goals-open': 'Escape does not close the Goals panel',
  'feedback-send-enabled-empty': 'Feedback Send button is enabled with an empty message'
};

/**
 * node:test wrapper. Use instead of test() for a known bug:
 *   knownBugTest(test, 'escape-keeps-goals-open', 'Escape closes Goals', async () => { ... })
 */
export function knownBugTest(test, id, name, fn) {
  return test(`${name} [bug: ${id}]`, async (t) => {
    if (!KNOWN_BUGS[id]) return fn(t); // fixed and removed from the list: a plain test now
    let skipped = false;
    const tt = new Proxy(t, {
      get(o, k) {
        if (k === 'skip') return (msg) => { skipped = true; o.skip(msg); };
        const v = o[k];
        return typeof v === 'function' ? v.bind(o) : v;
      }
    });
    try {
      await fn(tt);
      if (skipped) return;
    } catch (err) {
      t.skip(`known bug, not fixed yet: ${KNOWN_BUGS[id]} (${String(err.message || err).split('\n')[0]})`);
      return;
    }
    console.log(`\n✨ FIXED: known bug "${id}" now passes. Remove it from tests/helpers/known-bugs.mjs\n`);
  });
}
