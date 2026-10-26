// The card before each level, and its Back button.
import { test, expect } from './fixtures.mjs';

test('intro card names the product, the level and its goals', async ({ game, page }) => {
  await game.pick('url_shortener');
  const info = await game.run(async () => {
    const { LEVELS } = await import('/js/data/levels.js');
    const { getChallenges } = await import('/js/game/Challenges.js');
    return { total: LEVELS.length, name: LEVELS[0].name, goals: getChallenges(1).length };
  });
  const card = page.locator('.level-intro');
  await expect(card.locator('.li-product')).toContainText('URL Shortener');
  await expect(card.locator('.li-step')).toHaveText(`Level 1 of ${info.total}`);
  await expect(card.locator('.li-title')).toHaveText(info.name);
  await expect(card.locator('.li-goals > span')).toHaveCount(info.goals);
  await expect(card.locator('.li-label').last()).toContainText(`${info.goals} goals`);
});

test('the clock does not run while the intro card is open', async ({ game, page }) => {
  await game.pick('guestbook');
  expect(await game.run(g => g.isRunning)).toBeFalsy();
  await game.start();
  expect(await game.run(g => g.isRunning)).toBe(true);
});

test('Back on the intro card goes to the start screen, and Continue comes back to it', async ({ game, page }) => {
  await game.pick('guestbook');
  await expect(page.locator('#li-back')).toBeVisible();
  await page.click('#li-back');
  await expect(page.locator('#btn-new-game')).toBeVisible();
  await expect(page.locator('.level-intro')).toHaveCount(0);
  const cont = page.locator('#btn-continue-game');
  await expect(cont).toBeVisible();
  await expect(cont).toContainText('Guestbook');
  await cont.click();
  await expect(page.locator('#li-start')).toBeVisible();
});

test('the intro card is shown once per level: Continue after starting skips it', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.reload();
  await page.click('#btn-continue-game');
  await expect(page.locator('#hud-container')).not.toBeEmpty();
  await page.waitForTimeout(900);
  await expect(page.locator('.level-intro')).toBeHidden();
});
