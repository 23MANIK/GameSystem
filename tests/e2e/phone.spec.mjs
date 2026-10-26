// Phone layout (375×812), as checked by hand before every deploy.
import { test, expect } from './fixtures.mjs';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test('phone: diagram is vertical, Goals is a full-width sheet, nothing is off screen', async ({ game, page }) => {
  await game.newGame('url_shortener');
  await page.click('#guide-skip');
  await game.playLevel({ maxTicks: 20 });
  await game.pause();
  expect(await game.run(g => g.diagram.vertical)).toBe(true);
  await page.click('#nav-goals');
  const sheet = await page.locator('#side-panel').boundingBox();
  expect(sheet.width).toBeGreaterThanOrEqual(370);
  const off = await page.evaluate(() => [...document.querySelectorAll('.sd-node')]
    .map(n => n.getBoundingClientRect())
    .filter(r => r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1)).length);
  expect(off, 'diagram nodes outside the screen').toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('phone: the level intro and its buttons fit the screen', async ({ game, page }) => {
  await game.pick('guestbook');
  for (const sel of ['#li-start', '#li-back']) {
    const b = await page.locator(sel).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(375);
  }
});
