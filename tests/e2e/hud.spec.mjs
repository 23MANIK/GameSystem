// Top bar: speed, level card, coins, alerts.
import { test, expect } from './fixtures.mjs';

test('speed button cycles 1× → 2× → 4× → 1× and is remembered', async ({ game, page }) => {
  await game.newGame('guestbook');
  const speed = () => game.run((g, gs) => gs.speed);
  expect(await speed()).toBe(1);
  await page.click('#hud-speed'); expect(await speed()).toBe(2);
  await page.click('#hud-speed'); expect(await speed()).toBe(4);
  expect(await page.evaluate(() => localStorage.getItem('sa-speed'))).toBe('4');
  await page.click('#hud-speed'); expect(await speed()).toBe(1);
});

test('level card opens the level popover with every level listed; Escape closes it', async ({ game, page }) => {
  await game.newGame('cloud_drive');
  await page.click('#guide-skip');
  const total = await game.run(async () => (await import('/js/data/levels.js')).LEVELS.length);
  await page.click('#hud-level');
  const pop = page.locator('.level-pop:not(.money-pop)');
  await expect(pop).toBeVisible();
  await expect(pop.locator('.lv-list > li')).toHaveCount(total);
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
});

test('coins open the money popover', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await page.click('#hud-coins-btn');
  await expect(page.locator('.money-pop')).toBeVisible();
  await page.click('#hud-coins-btn');
  await expect(page.locator('.money-pop')).toBeHidden();
});

test('alerts: notifications collect in the Alerts tab and the badge clears', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await game.run(g => { g.notifications.show('Test alert one', 'info'); g.notifications.show('Test alert two', 'warning'); });
  await expect(page.locator('#nav-alerts-badge')).toBeVisible();
  await page.click('#nav-alerts');
  await expect(page.locator('.nt-msg', { hasText: 'Test alert two' })).toBeVisible();
  await page.click('#panel-close-btn');
  await expect(page.locator('#nav-alerts-badge')).toBeHidden();
});

test('the game keeps running for a minute of game time with no errors in the page', async ({ game, page }) => {
  await game.newGame('news_feed');
  await page.click('#guide-skip');
  await game.pause();
  await page.evaluate(() => window.__testBot.ticks(30));
  const st = await game.run((g, gs) => ({ users: gs.users, ok: Number.isFinite(gs.coins) }));
  expect(st.ok).toBe(true);
});
