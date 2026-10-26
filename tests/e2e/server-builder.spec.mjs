// Server Builder: upgrades, tabs, code fixes, extra machines, disk space.
import { test, expect, knownBug } from './fixtures.mjs';

/** Guestbook with a cheapest server placed and open, guide skipped, clock stopped. */
async function withServer(game, page, product = 'guestbook') {
  await game.newGame(product);
  await page.click('#guide-skip');
  await game.pause();
  await game.run((g, gs) => {
    gs.coins = 20000;
    g.serverBuilder.open(({ upgrade, role }) => { if (!upgrade) g.startPlacement(role); });
    g.serverBuilder.confirm();
    const t = g.placementTiles('app')[0];
    g.placeMachine('app', t.x, t.y);
  });
}

test('upgrade: pick a bigger CPU, the preview and price update, coins drop, the limit grows', async ({ game, page }) => {
  await withServer(game, page);
  const before = await game.run((g, gs) => ({ coins: gs.coins, limit: gs.serverStatus.userLimit, cpu: gs.server.cpu }));
  await page.click('#nav-server');
  await expect(page.locator('#sb-confirm')).toHaveText(/Pick a bigger part/);
  await expect(page.locator('#sb-confirm')).toBeDisabled();
  await page.click('.sb-option[data-part="cpu"][data-option="cpu_4"]');
  await page.click('.sb-option[data-part="ram"][data-option="ram_4"]');
  await expect(page.locator('#sb-confirm')).toHaveText(/Upgrade · 💰/);
  await page.click('#sb-confirm');
  const after = await game.run((g, gs) => ({ coins: gs.coins, limit: gs.serverStatus.userLimit, cpu: gs.server.cpu }));
  expect(after.cpu).toBe('cpu_4');
  expect(after.coins).toBe(before.coins - (600 - 100) - (450 - 80));
  expect(after.limit).toBeGreaterThan(before.limit);
});

test('upgrade is refused with too few coins', async ({ game, page }) => {
  await withServer(game, page);
  await game.run((g, gs) => { gs.coins = 10; });
  await page.click('#nav-server');
  await page.click('.sb-option[data-part="cpu"][data-option="cpu_4"]');
  await expect(page.locator('#sb-confirm')).toHaveText(/Not enough coins/);
  await expect(page.locator('#sb-confirm')).toBeDisabled();
});

test('XL parts are locked until Level 5', async ({ game, page }) => {
  await withServer(game, page);
  await page.click('#nav-server');
  await expect(page.locator('.sb-option[data-part="cpu"]').first()).toBeVisible();
  const xl = page.locator('.sb-option[data-option="cpu_8"]');
  if (await xl.count()) await expect(xl).toBeDisabled();
});

test('Level 2: tabs for app server, database and code fixes; buying a fix installs it', async ({ game, page }) => {
  await game.newGame('guestbook');
  expect((await game.playLevel()).done).toBe(true);
  await page.click('#level-up-continue');
  await game.start();
  await game.pause();
  await game.run((g, gs) => { gs.coins = 50000; });
  await page.click('#guide-skip').catch(() => {});
  await page.click('#nav-server');
  await expect(page.locator('.sb-tab[data-tab="app"]')).toBeVisible();
  await expect(page.locator('.sb-tab[data-tab="db"]')).toBeVisible();
  await page.click('.sb-tab[data-tab="code"]');
  const buy = page.locator('.sb-fix-buy').first();
  const fix = await buy.getAttribute('data-fix');
  await buy.click();
  expect(await game.run((g, gs, id) => gs.codeFixes[id], fix)).toBe(true);
  await expect(page.locator('.sb-fix-owned').first()).toBeVisible();
});

test('Level 2: build and place the database through the builder and its slot', async ({ game, page }) => {
  await game.newGame('guestbook');
  await game.playLevel();
  await page.click('#level-up-continue');
  await game.start();
  await game.pause();
  await game.run((g, gs) => { gs.coins = 50000; });
  await page.click('#guide-skip').catch(() => {});
  await page.click('#nav-server');
  await page.click('.sb-tab[data-tab="db"]');
  await expect(page.locator('#sb-confirm')).toHaveText(/Buy database/);
  await page.click('#sb-confirm');
  await page.locator('.sd-slot').click();
  expect(await game.run((g, gs) => gs.isDbPlaced())).toBe(true);
  await expect(page.locator('.sd-node.role-db')).toBeVisible();
});

test('extra app servers: added behind the load balancer once it is placed', async ({ game, page }) => {
  await game.newGame('guestbook');
  // Play until a level lets you run several app servers
  for (let i = 0; i < 8; i++) {
    const ok = await game.run(async (g, gs) => Boolean((await import('/js/products/registry.js')).scaleOutRule('app', gs.level)) && gs.isPlaced('lb'));
    if (ok) break;
    expect((await game.playLevel()).done).toBe(true);
    await game.run(g => g.startNextLevel());
    await game.start();
    await game.playLevel({ maxTicks: 3 });
  }
  await game.pause();
  const n = await game.run((g, gs) => { gs.coins = 100000; return gs.appCount(); });
  await page.click('#nav-server');
  await page.click('.sb-tab[data-tab="app"]');
  await page.click('#sb-add-app');
  expect(await game.run((g, gs) => gs.appCount())).toBe(n + 1);
});

knownBug('hdd-to-ssd-shrinks-disk', 'HDD → SSD is blocked (or clearly warned) when the data no longer fits', async ({ game, page }) => {
  await withServer(game, page);
  // 3,000 entries on a 6,000-entry HDD; an SSD holds only 1,500
  await game.run((g, gs) => { gs.guestbook.count = 3000; gs.users = 50; gs.recalculateMetrics(); });
  const before = await game.run((g, gs) => ({ users: gs.users, entries: gs.guestbook.count }));
  await page.click('#nav-server');
  await page.click('.sb-option[data-part="storage"][data-option="disk_ssd"]');
  const warning = page.locator('.sb-part[data-part="storage"], #sb-summary, #sb-confirm');
  await expect(warning.filter({ hasText: /too small|does(n.t| not) fit|won.t fit|smaller than/i }).first()).toBeVisible();
  const btn = page.locator('#sb-confirm');
  if (await btn.isEnabled()) await btn.click();
  const after = await game.run((g, gs) => ({ storage: gs.server.storage, users: gs.users, entries: gs.guestbook.count }));
  expect(after.storage, 'switched to a disk smaller than the data').toBe('disk_hdd');
  expect(after.entries).toBe(before.entries);
  expect(after.users).toBe(before.users);
});

knownBug('storage-tradeoff-unexplained', 'storage cards explain the speed vs size trade-off', async ({ game, page }) => {
  await game.newGame('guestbook');
  await game.playLevel();
  await page.click('#level-up-continue');
  await game.start();
  await game.pause();
  await page.click('#guide-skip').catch(() => {});
  await page.click('#nav-server');
  await page.click('.sb-tab[data-tab="db"]');
  const storage = page.locator('.sb-part[data-part="storage"]');
  await expect(storage).toContainText(/trade/i);
  await expect(storage).toContainText(/HDD/);
  await expect(storage).toContainText(/SSD/);
  await expect(storage.locator('.sb-option-space').first()).toBeVisible(); // how much each disk holds
});
