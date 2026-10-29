// V4 minimal UI: menu, health chip, Goals as the only "next step", level-complete screen,
// Continue-first start screen and the game picker.
import { test, expect } from './fixtures.mjs';

test('top bar keeps only menu, level, coins, users and speed; Home and Feedback live in the menu', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await expect(page.locator('#hud-home')).toBeHidden();
  await page.click('#hud-menu');
  await expect(page.locator('#hud-home')).toBeVisible();
  await expect(page.locator('#hud-feedback')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hud-home')).toBeHidden();
});

test('menu → All levels opens the level popover and keeps it open', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await page.click('#hud-menu');
  await page.click('#hud-menu-levels');
  await expect(page.locator('.level-pop:not(.money-pop)')).toBeVisible();
  await expect(page.locator('.hud-menu-pop')).toBeHidden();
});

test('health chip appears once there is a server and opens the full meters', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await expect(page.locator('#hud-resources')).toBeHidden();
  await game.playLevel({ maxTicks: 20 });
  await expect(page.locator('#hud-resources')).toBeVisible();
  await page.click('#hud-resources');
  const pop = page.locator('.hud-health-pop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('#hud-res-cpu')).toBeVisible();
  await expect(pop.locator('#hud-latency')).not.toHaveText('–');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
});

test('top bar has no users count; users / limit live in the health popover', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await game.playLevel({ maxTicks: 20 });
  await expect(page.locator('.hud .hud-stat.users')).toHaveCount(0);
  await page.click('#hud-resources');
  await expect(page.locator('.hud-health-pop #hud-users')).toBeVisible();
  await expect(page.locator('.hud-health-pop #hud-users')).toContainText('/');
});

test('no floating Next step card: the next goal lives only in Goals', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await expect(page.locator('#next-step')).toHaveCount(0);
  await page.click('#nav-goals');
  await expect(page.locator('#side-panel .gp-focus')).toContainText('Next up');
});

test('level complete: key stats up front, the rest folded; Look around → Goals offers the next level', async ({ game, page }) => {
  await game.newGame('guestbook');
  expect((await game.playLevel()).done).toBe(true);
  const overlay = page.locator('#level-up-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.lc-key > div')).toHaveCount(3);
  await expect(overlay.locator('details.lc-all')).not.toHaveAttribute('open', /.*/);
  await page.click('#level-up-stay');
  await expect(overlay).toBeHidden();
  await page.click('#nav-goals');
  await page.click('#goals-next');
  await expect(page.locator('#li-start')).toBeVisible();
});

test('start screen with a save: Continue card shows the game and level, New game is secondary', async ({ game, page }) => {
  await game.newGame('url_shortener');
  await game.run(g => g.gameState.save());
  await page.goto('/');
  const cont = page.locator('#btn-continue-game');
  await expect(cont).toBeVisible();
  await expect(cont).toContainText('URL Shortener');
  await expect(cont).toContainText('Level 1 of');
  await expect(page.locator('#intro-screen')).toHaveClass(/has-save/);
});

test('picker: one "Start here" game for new players; locked games fold into one line', async ({ game, page }) => {
  await game.home();
  await page.click('#btn-new-game');
  await expect(page.locator('.pp-card.pp-start')).toHaveCount(1);
  await expect(page.locator('.pp-start')).toHaveAttribute('data-product', 'guestbook');
  const soon = page.locator('details.pp-soon');
  await expect(soon).toBeVisible();
  await expect(soon.locator('.pp-play').first()).toBeHidden();
  await soon.locator('summary').click();
  await expect(soon.locator('.pp-play').first()).toBeVisible();
});

test('picker with a save: the saved game is marked in progress and nothing says Start here', async ({ game, page }) => {
  await game.newGame('url_shortener');
  await game.run(g => g.gameState.save());
  await page.goto('/');
  await page.click('#btn-new-game');
  await expect(page.locator('.pp-card.pp-start')).toHaveCount(0);
  await expect(page.locator('.pp-saved')).toHaveAttribute('data-product', 'url_shortener');
});

test('phone: top bar and health chip fit without sideways scrolling', async ({ game, page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await game.newGame('url_shortener');
  await page.click('#guide-skip');
  await game.playLevel({ maxTicks: 20 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const box = await page.locator('#hud-speed').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(375);
});
