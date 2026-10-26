/**
 * fixtures.mjs — shared helpers for the browser tests.
 *
 * - Google Fonts and /api calls are stubbed, so tests are fast and offline.
 * - Any uncaught error in the page fails the test.
 * - game.* helpers start a product, press Start, fast-forward a level, etc.
 */
import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_BUGS } from '../helpers/known-bugs.mjs';

const BOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bot.js');

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    // Repeatable randomness (spikes, incidents), as in the headless play-test
    await page.addInitScript(seed => {
      let s = seed;
      Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    }, Number(process.env.E2E_SEED || 7));
    await use(page);
    expect(errors, `errors thrown in the page during "${testInfo.title}"`).toEqual([]);
  },

  game: async ({ page }, use) => {
    const game = {
      page,
      /** Home screen with no save. */
      async home() {
        await page.goto('/');
        await expect(page.locator('#btn-new-game')).toBeVisible();
      },
      /** New Game → pick a product → its Level 1 intro card is showing. */
      async pick(productId) {
        await game.home();
        await page.click('#btn-new-game');
        await page.locator(`.pp-play[data-product="${productId}"]`).click();
        await expect(page.locator('#li-start')).toBeVisible();
      },
      /** Press Start on the intro card. */
      async start() {
        await page.click('#li-start');
        await expect(page.locator('.level-intro')).toBeHidden();
      },
      /** Pick a product and start Level 1. */
      async newGame(productId) {
        await game.pick(productId);
        await game.start();
        await page.addScriptTag({ path: BOT });
      },
      /** Bot plays the current level to the end. */
      async playLevel(opts = {}) {
        await page.addScriptTag({ path: BOT });
        const r = await page.evaluate(o => window.__testBot.playLevel(o), opts);
        if (!opts.maxTicks) expect(r.done, `bot did not finish level ${r.level}; pending: ${r.pending.join(', ')}`).toBe(true);
        return r;
      },
      /** Run code against the game: fn(window.__game, gameState). */
      run(fn, arg) {
        return page.evaluate(([src, a]) => {
          const g = window.__game;
          return new Function('g', 'gs', 'arg', `return (${src})(g, gs, arg)`)(g, g.gameState, a);
        }, [fn.toString(), arg]);
      },
      /** Stop the clock so the test controls time. */
      async pause() {
        await game.run(g => g.stopGameLoop());
      },
      /** Load a module of the game in the page. */
      async evalModule(modPath, fnSrc) {
        return page.evaluate(async ([p, src]) => new Function('m', `return (${src})(m)`)(await import(p)), [modPath, fnSrc.toString()]);
      }
    };
    await use(game);
  }
});

/**
 * A test for a bug listed in tests/helpers/known-bugs.mjs. If it fails it is
 * marked skipped ("known bug"), so the deploy is not blocked; if it passes it
 * is annotated "FIXED" so the entry can be removed.
 */
export function knownBug(id, name, fn) {
  test(`${name} [bug: ${id}]`, async ({ page, game }, testInfo) => {
    const fixtures = { page, game };
    if (!KNOWN_BUGS[id]) return fn(fixtures, testInfo);
    try {
      await fn(fixtures, testInfo);
    } catch (err) {
      testInfo.annotations.push({ type: 'known bug', description: KNOWN_BUGS[id] });
      test.skip(true, `known bug, not fixed yet: ${KNOWN_BUGS[id]} (${String(err.message || err).split('\n')[0]})`);
      return;
    }
    testInfo.annotations.push({ type: 'FIXED', description: `"${id}" now passes: remove it from tests/helpers/known-bugs.mjs` });
    console.log(`\n✨ FIXED: known bug "${id}" now passes. Remove it from tests/helpers/known-bugs.mjs\n`);
  });
}

export { expect };
