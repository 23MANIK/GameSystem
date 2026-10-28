// Google sign-in, cloud saves and analytics (js/firebase/account.js), against a
// fake Firebase SDK (tests/e2e/fake-firebase) whose "cloud" lives in this test.
import { test, expect } from './fixtures.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-firebase');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE' };
const NIKHIL = { uid: 'uid-nikhil', displayName: 'Test Player', email: 'player@example.com', photoURL: '' };

/** Serve the fake SDK and a shared fake Firestore to this page. */
async function fakeFirebase(page, cloud, user = NIKHIL) {
  await page.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z]+\.js)$/, (route) => {
    const file = route.request().url().match(/(firebase-[a-z]+\.js)$/)[1];
    route.fulfill({ status: 200, headers: CORS, contentType: 'text/javascript', body: fs.readFileSync(path.join(FAKE, file), 'utf8') });
  });
  await page.route(/fake-firestore\.test\//, (route) => {
    const req = route.request();
    const key = new URL(req.url()).pathname.slice(1);
    if (req.method() === 'DELETE') cloud.delete(key);
    if (req.method() === 'POST') {
      const { data, merge } = JSON.parse(req.postData());
      cloud.set(key, merge ? { ...(cloud.get(key) || {}), ...data, progress: { ...(cloud.get(key)?.progress || {}), ...(data.progress || {}) } } : data);
      cloud.writes = (cloud.writes || 0) + 1;
    }
    route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(req.method() === 'GET' ? (cloud.get(key) || null) : {}) });
  });
  await page.addInitScript((u) => {
    window.__SA_FIREBASE__ = { config: { apiKey: 'test', projectId: 'test', measurementId: 'G-TEST' } };
    window.__FAKE_GOOGLE_USER__ = u;
  }, user);
}

test('with Firebase off there is no sign-in button', async ({ game, page }) => {
  await game.home();
  await expect(page.locator('#intro-account')).toBeHidden();
});

test('sign in with Google uploads this device\'s progress to the account', async ({ game, page }) => {
  const cloud = new Map();
  await fakeFirebase(page, cloud);
  await game.newGame('guestbook');
  expect((await game.playLevel()).done).toBe(true);
  await page.goto('/');
  await page.click('.acct-google');
  await expect(page.getByTestId('account-signed-in')).toContainText('Test Player');
  await expect(page.locator('#intro-account')).toContainText('now saved to your account');
  const doc = cloud.get('users/uid-nikhil');
  expect(doc.productId).toBe('guestbook');
  expect(doc.level).toBe(1);
  expect(doc.levelCompleted).toBe(true);
  expect(doc.progress).toEqual({ guestbook: 1 });
  expect(JSON.parse(doc.save).productId).toBe('guestbook');
  expect(doc.email).toBe('player@example.com');
});

test('progress follows the player to another device', async ({ game, page, browser, baseURL }) => {
  const cloud = new Map();
  await fakeFirebase(page, cloud);
  await game.home();
  await page.click('.acct-google');
  await expect(page.getByTestId('account-signed-in')).toBeVisible();
  await page.click('#btn-new-game');
  await page.locator('.pp-play[data-product="url_shortener"]').click();
  await game.start();
  expect((await game.playLevel()).done).toBe(true);
  // Finishing a level uploads it straight away
  await expect.poll(() => cloud.get('users/uid-nikhil')?.levelCompleted).toBe(true);
  // …and so does leaving the game (Home)
  await game.run((g, gs) => { gs.coins = 777; g.goHome(); });
  await expect(page.locator('#btn-continue-game')).toBeVisible();
  await expect.poll(() => JSON.parse(cloud.get('users/uid-nikhil').save).coins).toBe(777);

  // A second device: fresh browser, no local save. Sign in → the cloud save comes down.
  const other = await browser.newContext({ baseURL });
  const phone = await other.newPage();
  await phone.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await fakeFirebase(phone, cloud);
  await phone.goto('/');
  await expect(phone.locator('#btn-continue-game')).toBeHidden();
  await phone.click('.acct-google');
  await expect(phone.locator('#btn-continue-game')).toBeVisible();
  await expect(phone.locator('#btn-continue-game')).toContainText('URL Shortener');
  // Next visit: still signed in, the save is checked before the start screen shows
  await phone.reload();
  await expect(phone.getByTestId('account-signed-in')).toBeVisible();
  await expect(phone.locator('#btn-continue-game')).toContainText('Level 1');
  await phone.click('#btn-continue-game');
  await expect(phone.locator('#hud-container')).not.toBeEmpty();
  expect(await phone.evaluate(() => Math.round(window.__game.gameState.coins))).toBe(777);
  await other.close();
});

test('the newer save wins: a newer cloud save replaces an older local one', async ({ game, page }) => {
  const cloud = new Map();
  await fakeFirebase(page, cloud);
  await game.newGame('guestbook');
  await game.pause();
  await game.run((g, gs) => gs.save());
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('scale_architect_save_v4')));
  save.productId = 'news_feed';
  save.level = 1;
  cloud.set('users/uid-nikhil', { save: JSON.stringify(save), savedAt: Date.now() + 60_000, progress: {} });
  await page.goto('/');
  await page.click('.acct-google');
  await expect(page.locator('#btn-continue-game')).toContainText('News Feed');
});

test('signing out keeps the game on this device and stops uploading', async ({ game, page }) => {
  const cloud = new Map();
  await fakeFirebase(page, cloud);
  await game.home();
  await page.click('.acct-google');
  await expect(page.getByTestId('account-signed-in')).toBeVisible();
  await page.getByTestId('account-signed-in').click();
  await page.click('.pf-signout');
  await expect(page.locator('.acct-google')).toBeVisible();
  await expect(page.locator('#intro-account')).toContainText('Signed out');
  const writes = cloud.writes || 0;
  await game.newGame('guestbook');
  await game.run((g, gs) => gs.save());
  await page.goto('/');
  await expect(page.locator('#btn-continue-game')).toBeVisible();
  await expect(page.locator('.acct-google')).toBeVisible();
  expect(cloud.writes || 0).toBe(writes);
});

test('gameplay events are sent to analytics, signed in or not', async ({ game, page }) => {
  await fakeFirebase(page, new Map());
  await game.newGame('guestbook');
  expect((await game.playLevel()).done).toBe(true);
  const events = await page.evaluate(() => window.__analyticsEvents.map(e => e.name));
  expect(events).toEqual(expect.arrayContaining(['game_start', 'level_start', 'level_complete']));
  const done = await page.evaluate(() => window.__analyticsEvents.find(e => e.name === 'level_complete').params);
  expect(done).toMatchObject({ product_id: 'guestbook', level: 1 });
});

test('a closed sign-in popup leaves the player signed out without an error', async ({ game, page }) => {
  await fakeFirebase(page, new Map(), null);
  await game.home();
  await page.click('.acct-google');
  await expect(page.locator('.acct-google')).toBeEnabled();
  await expect(page.getByTestId('account-signed-in')).toBeHidden();
});

test('the ☰ menu in the game signs in, opens the profile, and signs out', async ({ game, page }) => {
  const cloud = new Map();
  await fakeFirebase(page, cloud);
  await game.newGame('guestbook');
  await page.click('#hud-menu');
  const item = page.locator('#hud-menu-account');
  await expect(item).toContainText('Sign in with Google');
  await item.click();
  await expect(page.locator('#notification-container')).toContainText('Signed in as Test Player');
  await expect.poll(() => cloud.get('users/uid-nikhil')?.productId).toBe('guestbook');
  await page.click('#hud-menu');
  await expect(item).toContainText('Test Player');
  await item.click();
  await expect(page.locator('.pf-dialog')).toBeVisible();
  await page.click('.pf-signout');
  await expect(page.locator('#notification-container')).toContainText('Signed out');
  await page.click('#hud-menu');
  await expect(item).toContainText('Sign in with Google');
});

test('the ☰ menu has no sign-in item when Firebase is off', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#hud-menu');
  await expect(page.locator('#hud-menu-account')).toBeHidden();
});

test('a sign-in refused by Firebase says why', async ({ game, page }) => {
  await fakeFirebase(page, new Map(), { __error: 'auth/operation-not-allowed' });
  await game.home();
  await page.click('.acct-google');
  await expect(page.locator('#intro-account')).toContainText('Google sign-in is not switched on');
  await expect(page.locator('.acct-google')).toBeEnabled();
});
