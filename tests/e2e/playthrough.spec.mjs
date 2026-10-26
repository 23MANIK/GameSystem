// Every playable design pack, played from Level 1 to the last level in the real page.
// One test per pack, so they run in parallel. New packs (e.g. Ticket Booking and
// Ad Click Aggregator from PR #7) are picked up automatically.
import { test, expect } from './fixtures.mjs';
import { packIds } from '../helpers/harness.mjs';

for (const id of await packIds()) {
  test(`${id}: every level loads, plays through and hands over to the next`, async ({ game, page }) => {
    test.setTimeout(180_000);
    await game.pick(id);
    const total = await game.run(async () => (await import('/js/data/levels.js')).LEVELS.filter(l => !l.comingSoon).length);
    await game.start();
    const log = [];
    for (let level = 1; level <= total; level++) {
      await expect(page.locator('#hud-level')).toBeVisible();
      const r = await game.playLevel();
      log.push(`L${r.level} ${r.done ? 'done' : 'STUCK'} ${r.minutes} min ${r.users} users${r.pending.length ? ` pending: ${r.pending.join(', ')}` : ''}`);
      expect(r.done, log.join('\n')).toBe(true);
      expect(r.level).toBe(level);
      const overlay = page.locator('#level-up-overlay');
      await expect(overlay).toBeVisible();
      await expect(overlay.locator('.level-up-title')).toHaveText('LEVEL COMPLETE!');
      if (level < total) {
        await expect(page.locator('#level-up-continue')).toHaveText(`Start Level ${level + 1} →`);
        await page.click('#level-up-continue');
        await expect(page.locator('.li-step')).toHaveText(`Level ${level + 1} of ${total}`);
        await game.start();
      } else {
        await expect(overlay).toContainText(/finished every level/i);
      }
    }
    test.info().annotations.push({ type: 'levels', description: log.join(' | ') });
  });
}
