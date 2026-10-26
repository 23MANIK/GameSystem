// Start screen and the product picker.
import { test, expect } from './fixtures.mjs';

test('start screen: title, New Game, feedback, and no Continue without a save', async ({ game, page }) => {
  await game.home();
  await expect(page).toHaveTitle(/Scale Architect/);
  await expect(page.locator('#btn-new-game')).toBeVisible();
  await expect(page.locator('#btn-continue-game')).toBeHidden();
  await expect(page.locator('#btn-feedback')).toBeVisible();
});

test('picker shows every design; playable ones can be picked, the rest are locked', async ({ game, page }) => {
  await game.home();
  await page.click('#btn-new-game');
  await expect(page.locator('#product-screen')).toBeVisible();
  const products = await game.evalModule('/js/data/products.js', m => m.PRODUCTS.map(p => ({ id: p.id, name: p.name, playable: Boolean(p.playable) })));
  expect(products.length).toBeGreaterThanOrEqual(7);
  for (const p of products) {
    const btn = page.locator(`.pp-play[data-product="${p.id}"]`);
    await expect(btn, `${p.id} card`).toHaveCount(1);
    if (p.playable) await expect(btn, `${p.id} should be playable`).toBeEnabled();
    else await expect(btn, `${p.id} should be locked`).toBeDisabled();
  }
  // The designs from the roadmap that are not built yet stay locked
  for (const id of ['chat', 'video', 'ride_hailing']) {
    const p = products.find(x => x.id === id);
    if (p && !p.playable) await expect(page.locator(`.pp-play[data-product="${id}"]`)).toBeDisabled();
  }
});

test('picker Back returns to the start screen', async ({ game, page }) => {
  await game.home();
  await page.click('#btn-new-game');
  await page.click('#pp-back');
  await expect(page.locator('#product-screen')).toBeHidden();
  await expect(page.locator('#btn-new-game')).toBeVisible();
});

test('picker warns that a new product replaces the saved game', async ({ game, page }) => {
  await game.newGame('guestbook');
  await game.run(g => g.gameState.save());
  await page.goto('/');
  await page.click('#btn-new-game');
  await expect(page.locator('.pp-save')).toContainText(/replaces your saved game/i);
});

test('picker fits a phone screen without sideways scrolling', async ({ game, page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await game.home();
  await page.click('#btn-new-game');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
