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
 */
export const KNOWN_BUGS = {
  // none right now: the 7 browser play-test findings were fixed in PR #7 / #8
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
