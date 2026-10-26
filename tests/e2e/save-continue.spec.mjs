// Saving, Continue, Home, and "Retry level".
import { test, expect } from './fixtures.mjs';

test('Continue after a reload brings back the same product, level, machines and coins', async ({ game, page }) => {
  await game.newGame('url_shortener');
  const r = await game.playLevel();
  expect(r.done).toBe(true);
  await page.click('#level-up-continue'); // Start Level 2
  await game.start();
  await game.pause();
  const before = await game.run((g, gs) => { gs.save(); return { level: gs.level, coins: Math.round(gs.coins), machines: gs.machines, product: gs.productId }; });
  await page.reload();
  const cont = page.locator('#btn-continue-game');
  await expect(cont).toBeVisible();
  await expect(cont).toContainText('URL Shortener');
  await expect(cont).toContainText('Level 2');
  await cont.click();
  await expect(page.locator('#hud-container')).not.toBeEmpty();
  const after = await game.run((g, gs) => ({ level: gs.level, coins: Math.round(gs.coins), machines: gs.machines, product: gs.productId }));
  expect(after).toEqual(before);
  await expect(page.locator('.sd-node.role-app')).toBeVisible();
});

test('Home button saves and returns to the start screen; Continue resumes', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await game.run((g, gs) => { gs.coins = 4321; });
  await page.click('#hud-home');
  await expect(page.locator('#btn-continue-game')).toBeVisible();
  await page.click('#btn-continue-game');
  await expect(page.locator('#hud-coins')).toBeVisible();
  expect(await game.run((g, gs) => Math.round(gs.coins))).toBe(4321);
});

test('a finished level stays finished after a reload, with the next level offered', async ({ game, page }) => {
  await game.newGame('guestbook');
  expect((await game.playLevel()).done).toBe(true);
  await page.reload();
  await page.click('#btn-continue-game');
  await expect(page.locator('#hud-container')).not.toBeEmpty();
  expect(await game.run((g, gs) => [gs.level, gs.levelCompleted])).toEqual([1, true]);
  await page.click('#nav-goals');
  await expect(page.locator('#goals-next')).toContainText('Start Level 2');
  await page.click('#goals-next');
  await expect(page.locator('#li-start')).toBeVisible();
  await expect(page.locator('.li-step')).toContainText('Level 2');
});

test('New Game on a saved game starts the new product from Level 1', async ({ game, page }) => {
  await game.newGame('guestbook');
  await game.playLevel();
  await page.goto('/');
  await page.click('#btn-new-game');
  await page.locator('.pp-play[data-product="news_feed"]').click();
  await expect(page.locator('#li-start')).toBeVisible();
  await expect(page.locator('.li-product')).toContainText('News Feed');
  expect(await game.run((g, gs) => [gs.productId, gs.level, gs.server])).toEqual(['news_feed', 1, null]);
});

test('crash screen: Retry level restarts the level from its start', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await game.pause();
  const start = await game.run((g, gs) => Math.round(gs.coins));
  await game.run((g, gs) => {
    gs.coins = 0;
    g.crashScreen.open({ level: 1, levelName: gs.levelDef().name, earnedPerMin: 0, spentPerMin: 10, users: 0, canRetry: gs.hasLevelStart() });
  });
  await expect(page.locator('.crash-overlay')).toBeVisible();
  await expect(page.locator('#crash-title')).toHaveText('SYSTEM CRASHED');
  await page.locator('.crash-overlay button', { hasText: /retry/i }).click();
  await expect(page.locator('#hud-coins')).toBeVisible();
  expect(await game.run((g, gs) => Math.round(gs.coins))).toBe(start);
});
