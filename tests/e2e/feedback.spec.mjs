// The feedback form (home screen and the 💬 button in the top bar).
import { test, expect, knownBug } from './fixtures.mjs';

test('feedback: opens from the start screen, counts characters, closes with ✕', async ({ game, page }) => {
  await game.home();
  await page.click('#btn-feedback');
  const d = page.locator('dialog.fb-dialog');
  await expect(d).toBeVisible();
  await d.locator('textarea').fill('hello');
  await expect(d.locator('.fb-count')).toHaveText('5 / 1000');
  await d.locator('.fb-head .fb-close').click();
  await expect(d).toBeHidden();
});

test('feedback: sending shows the thank-you, with the message and context posted', async ({ game, page }) => {
  let body = null;
  await page.route('**/api/feedback', async r => { body = r.request().postDataJSON(); await r.fulfill({ json: { ok: true } }); });
  await game.home();
  await page.click('#btn-feedback');
  const d = page.locator('dialog.fb-dialog');
  await d.locator('textarea').fill('Level 3 felt too hard');
  await d.locator('input[name="name"]').fill('Tester');
  await d.locator('.fb-send').click();
  await expect(d.locator('.fb-done')).toBeVisible();
  expect(body).toMatchObject({ message: 'Level 3 felt too hard', name: 'Tester', context: 'home screen' });
});

test('feedback: a server error is shown and the form stays', async ({ game, page }) => {
  await page.route('**/api/feedback', r => r.fulfill({ status: 429, json: { error: 'Too many messages. Try later.' } }));
  await game.home();
  await page.click('#btn-feedback');
  const d = page.locator('dialog.fb-dialog');
  await d.locator('textarea').fill('Something broke');
  await d.locator('.fb-send').click();
  await expect(d.locator('.fb-status')).toHaveText('Too many messages. Try later.');
  await expect(d.locator('form')).toBeVisible();
});

test('feedback: works from the 💬 button during a game', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#hud-feedback');
  await expect(page.locator('dialog.fb-dialog')).toBeVisible();
});

knownBug('feedback-send-enabled-empty', 'feedback: Send is off until there is a message', async ({ game, page }) => {
  await game.home();
  await page.click('#btn-feedback');
  const d = page.locator('dialog.fb-dialog');
  await expect(d.locator('.fb-send')).toBeDisabled();
  await d.locator('textarea').fill('   ');
  await expect(d.locator('.fb-send')).toBeDisabled();
  await d.locator('textarea').fill('Great game');
  await expect(d.locator('.fb-send')).toBeEnabled();
});
