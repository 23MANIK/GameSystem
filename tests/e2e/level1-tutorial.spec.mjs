// Level 1 played by hand through the UI, with the guide.
import { test, expect } from './fixtures.mjs';

test('Guestbook Level 1: guide → build → place → open to the public → users arrive', async ({ game, page }) => {
  await game.newGame('guestbook');
  const guide = page.locator('#guide-bubble');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Step 1 of');
  await page.click('#guide-btn'); // Let's build
  await expect(page.locator('#nav-server')).toHaveClass(/guide-highlight/);

  // Server Builder: buy the default (cheapest) server
  await page.click('#nav-server');
  await expect(page.locator('#sb-confirm')).toBeVisible();
  await expect(page.locator('#sb-tip')).toBeVisible(); // the guide's tip moves inside the builder
  const coins = await game.run((g, gs) => gs.coins);
  await expect(page.locator('#sb-confirm')).toBeEnabled();
  await page.click('#sb-confirm');
  await expect(page.locator('#modal-backdrop')).toBeHidden();
  expect(await game.run((g, gs) => gs.coins)).toBeLessThan(coins);

  // Place it on the glowing slot
  const slot = page.locator('.sd-slot');
  await expect(slot).toBeVisible();
  await slot.click();
  await expect(slot).toHaveCount(0);
  expect(await game.run((g, gs) => gs.isServerPlaced())).toBe(true);

  // Open to the public
  await expect(page.locator('#guide-btn')).toHaveText(/Open to the public/);
  await page.click('#guide-btn');
  expect(await game.run((g, gs) => gs.appLive)).toBe(true);

  // Users arrive (fast-forward a few ticks)
  await game.pause();
  await page.evaluate(() => window.__testBot.ticks(30));
  expect(await game.run((g, gs) => gs.users)).toBeGreaterThan(0);
  await expect(page.locator('#hud-users')).not.toHaveText('0');
});

test('Skip tutorial hides the guide and opens the app', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await expect(page.locator('#guide-bubble')).toBeHidden();
  expect(await game.run((g, gs) => gs.appLive && !g.tutorial.active)).toBe(true);
});

test('Server Builder: Escape and Cancel close it without buying', async ({ game, page }) => {
  await game.newGame('guestbook');
  const coins = await game.run((g, gs) => gs.coins);
  await page.click('#nav-server');
  await expect(page.locator('#sb-confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-backdrop')).toBeHidden();
  await page.click('#nav-server');
  await page.click('#sb-cancel');
  await expect(page.locator('#modal-backdrop')).toBeHidden();
  expect(await game.run((g, gs) => [gs.coins, gs.server])).toEqual([coins, null]);
});
