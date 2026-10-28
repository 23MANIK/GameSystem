// The player profile (js/ui/ProfileDialog.js, js/firebase/profile.js): name,
// picture, title, bio, progress, sign out, delete account. Fake Firebase as in
// account.spec.mjs; the profile lives in profiles/{uid}, apart from the save.
import { test, expect } from './fixtures.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-firebase');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE' };
const PLAYER = { uid: 'uid-p', displayName: 'Test Player', email: 'player@example.com', photoURL: '' };

async function fakeFirebase(page, cloud, user = PLAYER) {
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
      cloud.set(key, merge ? { ...(cloud.get(key) || {}), ...data } : data);
    }
    route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(req.method() === 'GET' ? (cloud.get(key) || null) : {}) });
  });
  await page.addInitScript((u) => {
    window.__SA_FIREBASE__ = { config: { apiKey: 'test', projectId: 'test' } };
    window.__FAKE_GOOGLE_USER__ = u;
  }, user);
}

async function signedInHome(page, game, cloud) {
  await fakeFirebase(page, cloud);
  await game.home();
  await page.click('.acct-google');
  await expect(page.getByTestId('account-signed-in')).toBeVisible();
}

test('edit name, picture, title and bio; the game shows them everywhere', async ({ game, page }) => {
  const cloud = new Map();
  await signedInHome(page, game, cloud);
  await page.getByTestId('account-signed-in').click();
  const d = page.locator('.pf-dialog');
  await expect(d).toBeVisible();
  await expect(d.locator('input[name=name]')).toHaveValue('Test Player');
  await d.locator('input[name=name]').fill('  Ada   Lovelace ');
  await d.locator('input[name=title]').fill('Backend engineer');
  await d.locator('textarea[name=bio]').fill('Learning caches.');
  await d.locator('.pf-pic[data-avatar="emoji:🦊"]').click();
  await d.locator('.pf-save').click();
  await expect(d).toBeHidden();
  expect(cloud.get('profiles/uid-p')).toMatchObject({ name: 'Ada Lovelace', title: 'Backend engineer', bio: 'Learning caches.', avatar: 'emoji:🦊', photo: '' });
  await expect(page.getByTestId('account-signed-in')).toContainText('Ada Lovelace');
  await expect(page.locator('#intro-account .acct-emoji')).toHaveText('🦊');

  // Another visit: the profile loads from the account, and the ☰ menu shows it too
  await page.reload();
  await expect(page.getByTestId('account-signed-in')).toContainText('Ada Lovelace');
  await page.click('#btn-new-game');
  await page.locator('.pp-play[data-product="guestbook"]').click();
  await game.start();
  await page.click('#hud-menu');
  await expect(page.locator('#hud-menu-account')).toContainText('Ada Lovelace');
  await page.locator('#hud-menu-account').click();
  await expect(d.locator('textarea[name=bio]')).toHaveValue('Learning caches.');
});

test('an empty name is not saved', async ({ game, page }) => {
  const cloud = new Map();
  await signedInHome(page, game, cloud);
  await page.getByTestId('account-signed-in').click();
  await page.locator('.pf-dialog input[name=name]').fill('   ');
  await page.locator('.pf-save').click();
  await expect(page.locator('.pf-status')).toHaveText('Please enter a name.');
  expect(cloud.get('profiles/uid-p')).toBeUndefined();
});

test('upload a picture: it is shrunk to a small square and saved with the profile', async ({ game, page }) => {
  const cloud = new Map();
  await signedInHome(page, game, cloud);
  await page.getByTestId('account-signed-in').click();
  // A big 1200×800 PNG made in the page
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const x = c.getContext('2d'); x.fillStyle = '#e11d48'; x.fillRect(0, 0, 1200, 800);
    return c.toDataURL('image/png').split(',')[1];
  });
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.pf-pic[data-avatar="upload"]').click();
  await (await chooser).setFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('.pf-status')).toContainText('Press Save profile');
  await page.locator('.pf-save').click();
  await expect(page.locator('.pf-dialog')).toBeHidden();
  const saved = cloud.get('profiles/uid-p');
  expect(saved.avatar).toBe('upload');
  expect(saved.photo).toMatch(/^data:image\/jpeg;base64,/);
  expect(saved.photo.length).toBeLessThan(100_000);
  const size = await page.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = src; }), saved.photo);
  expect(size).toEqual([192, 192]);
  await expect(page.locator('#intro-account img.acct-avatar')).toHaveAttribute('src', saved.photo);
});

test('the profile shows progress saved to the account', async ({ game, page }) => {
  const cloud = new Map();
  await signedInHome(page, game, cloud);
  cloud.set('users/uid-p', { ...cloud.get('users/uid-p'), progress: { guestbook: 3, url_shortener: 1 }, createdAt: { seconds: Date.UTC(2026, 9, 1) / 1000 } });
  await page.getByTestId('account-signed-in').click();
  await expect(page.getByTestId('pf-levels')).toHaveText('4');
  await expect(page.locator('.pf-games li')).toHaveCount(2);
  await expect(page.locator('.pf-games')).toContainText('Guestbook');
  await expect(page.locator('.pf-stats')).toContainText('2026');
});

test('delete account removes the profile and cloud save, keeps the game on this device', async ({ game, page }) => {
  const cloud = new Map();
  await fakeFirebase(page, cloud);
  await game.newGame('guestbook');
  await game.run((g, gs) => gs.save());
  await page.goto('/');
  await page.click('.acct-google');
  await expect(page.getByTestId('account-signed-in')).toBeVisible();
  await expect.poll(() => Boolean(cloud.get('users/uid-p')?.save)).toBe(true);
  await page.getByTestId('account-signed-in').click();
  await page.locator('.pf-save').click();
  await expect.poll(() => Boolean(cloud.get('profiles/uid-p'))).toBe(true);

  // Firebase wants a fresh sign-in before deleting: the player picks their account again
  await page.evaluate(() => { window.__FAKE_RECENT_LOGIN__ = false; });
  await page.getByTestId('account-signed-in').click();
  await page.click('.pf-delete');
  await expect(page.locator('.pf-confirm')).toContainText('deleted for good');
  await page.click('.pf-delete-yes');
  await expect(page.locator('.pf-dialog')).toBeHidden();
  await expect(page.locator('.acct-google')).toBeVisible();
  await expect(page.locator('#intro-account')).toContainText('account was deleted');
  expect(cloud.has('users/uid-p')).toBe(false);
  expect(cloud.has('profiles/uid-p')).toBe(false);
  expect(await page.evaluate(() => window.__fakeDeletedUsers)).toEqual(['uid-p']);
  await expect(page.locator('#btn-continue-game')).toBeVisible();
});

test('cancel keeps the account', async ({ game, page }) => {
  const cloud = new Map();
  await signedInHome(page, game, cloud);
  await page.getByTestId('account-signed-in').click();
  await page.click('.pf-delete');
  await page.click('.pf-delete-no');
  await expect(page.locator('.pf-confirm')).toBeHidden();
  await page.locator('.fb-close').first().click();
  await expect(page.getByTestId('account-signed-in')).toBeVisible();
  expect(cloud.has('users/uid-p')).toBe(true);
});

test('an optional UPI ID is saved with the profile and fills in UPI boxes', async ({ game, page }) => {
  const cloud = new Map();
  await signedInHome(page, game, cloud);
  await page.getByTestId('account-signed-in').click();
  const upi = page.locator('.pf-dialog input[name=upi]');
  await upi.fill('not-a-upi');
  await page.locator('.pf-save').click();
  await expect(page.locator('.pf-status')).toContainText('UPI ID');
  expect(cloud.get('profiles/uid-p')).toBeUndefined();
  await upi.fill('Ada.L@OkAxis');
  await page.locator('.pf-save').click();
  await expect(page.locator('.pf-dialog')).toBeHidden();
  expect(cloud.get('profiles/uid-p').upi).toBe('ada.l@okaxis');

  // Another visit: any UPI box the game shows is filled from the profile (empty ones only)
  await page.reload();
  await expect(page.getByTestId('account-signed-in')).toBeVisible();
  const filled = await page.evaluate(async () => {
    const { fillUpiInput } = await import('/js/firebase/profile.js');
    const empty = document.createElement('input');
    const typed = Object.assign(document.createElement('input'), { value: 'mine@ybl' });
    return [await fillUpiInput(empty), empty.value, await fillUpiInput(typed), typed.value];
  });
  expect(filled).toEqual([true, 'ada.l@okaxis', false, 'mine@ybl']);
  await page.getByTestId('account-signed-in').click();
  await expect(upi).toHaveValue('ada.l@okaxis');
});
