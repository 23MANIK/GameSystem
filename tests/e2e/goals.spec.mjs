// The Goals panel.
import { test, expect, knownBug } from './fixtures.mjs';

test('Goals lists every goal of the level with progress, and closes with ✕', async ({ game, page }) => {
  await game.newGame('guestbook');
  const count = await game.run(async () => (await import('/js/game/Challenges.js')).getChallenges(1).length);
  await page.click('#nav-goals');
  await expect(page.locator('#side-panel')).toHaveClass(/open/);
  await expect(page.locator('#panel-title')).toContainText('Goals');
  await expect(page.locator('.gp-row')).toHaveCount(count);
  await expect(page.locator('.gp-seg')).toHaveCount(count);
  await expect(page.locator('.gp-focus')).toBeVisible();
  await page.click('#panel-close-btn');
  await expect(page.locator('#side-panel')).toHaveClass(/closed/);
});

test('Goals: tapping a goal puts it in focus; done goals tick as they are met', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#nav-goals');
  const second = page.locator('.gp-row').nth(1);
  const id = await second.getAttribute('data-goal');
  await second.click();
  await expect(page.locator(`.gp-row[data-goal="${id}"]`)).toHaveClass(/focus/);
  // Play the level: every row ends up done, and the panel offers the next level
  await page.click('#panel-close-btn');
  await game.playLevel();
  await page.locator('#level-up-overlay').evaluate(el => { el.style.display = 'none'; });
  await page.click('#nav-goals');
  await expect(page.locator('.gp-row.done')).toHaveCount(await page.locator('.gp-row').count());
  await expect(page.locator('.gp-complete')).toBeVisible();
  await expect(page.locator('#goals-next')).toBeVisible();
});

test('the Goals tab button toggles the panel', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#nav-goals');
  await expect(page.locator('#nav-goals')).toHaveClass(/active/);
  await page.click('#nav-goals');
  await expect(page.locator('#side-panel')).toHaveClass(/closed/);
});

knownBug('escape-keeps-goals-open', 'Escape closes the Goals panel', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await page.click('#nav-goals');
  await expect(page.locator('#side-panel')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#side-panel')).toHaveClass(/closed/, { timeout: 2000 });
});

knownBug('pending-goal-green-check', 'a goal that is not done never shows a check mark', async ({ game, page }) => {
  await game.newGame('guestbook');
  // Find the first level with a goal whose own icon is a check mark, and play up to it
  const target = await game.run(async () => {
    const { getChallenges } = await import('/js/game/Challenges.js');
    const { LEVELS } = await import('/js/data/levels.js');
    for (const L of LEVELS) if (getChallenges(L.level).some(c => /^[✅✔☑]/.test(c.icon))) return L.level;
    return 4;
  });
  for (let lv = 1; lv < target; lv++) {
    expect((await game.playLevel()).done).toBe(true);
    await game.run(g => g.startNextLevel());
    await game.start();
  }
  await game.pause();
  await page.click('#guide-skip').catch(() => {});
  await page.click('#nav-goals');
  const rows = page.locator('.gp-row:not(.done) .gp-check');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const icon of await rows.allTextContents()) expect(icon.trim(), 'pending goal shows a check').not.toMatch(/^[✅✔☑✓]/);
  const focus = page.locator('.gp-focus-icon');
  if (await focus.count()) expect((await focus.textContent()).trim()).not.toMatch(/^[✅✔☑✓]/);
});
