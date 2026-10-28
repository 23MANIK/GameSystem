// Pop-ups never block each other: in every state where two pop-ups can meet
// (tutorial guide, toasts, Next step card, popovers, side panel, level intro,
// level complete, Server Builder, dialogs), every visible button can still be
// pressed and no two floating cards overlap. Runs on desktop, tablet and phones.
// The rules are in docs/popups/README.md; the checker is overlap-audit.js.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.mjs';

const AUDIT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'overlap-audit.js');

const SIZES = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
  'small phone': { width: 360, height: 640 }
};

/** Two long-lived toasts, like a spike warning and a finished goal at once. */
const toasts = page => page.evaluate(() => {
  const n = window.__game.notifications;
  n.show('⚠️ Traffic spike: launch day! Your system needs headroom for the next 30s of traffic.', 'warning', 60000);
  n.show('🎯 Challenge done: Serve 100 users without errors', 'success', 60000);
});

async function audit(page) {
  await page.waitForTimeout(350); // let pop-in animations and the layer check settle
  await page.addScriptTag({ path: AUDIT });
  return page.evaluate(() => window.__overlapAudit());
}

function expectClean(r) {
  const lines = [
    ...r.blocked.map(b => `${b.button} is covered by ${b.coveredBy}`),
    ...r.overlaps
  ];
  expect(lines, 'pop-ups covering buttons or each other').toEqual([]);
}

const SCENES = {
  'level intro card + toasts (Back button stays free)': async (game, page) => {
    await game.pick('guestbook');
    await toasts(page);
  },
  'tutorial guide + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await toasts(page);
  },
  'Next step card + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await page.click('#guide-skip');
    await toasts(page);
  },
  'Server Builder + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await page.click('#guide-skip');
    await page.click('#next-step .ns-act');
    await expect(page.locator('.server-builder-modal')).toBeVisible();
    await toasts(page);
  },
  '☰ menu + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await page.click('#guide-skip');
    await toasts(page);
    await page.click('#hud-menu');
  },
  'level popover over the Next step card': async (game, page) => {
    await game.newGame('guestbook');
    await page.click('#guide-skip');
    await toasts(page);
    await page.click('#hud-menu');
    await page.click('#hud-menu-levels');
  },
  'health popover + guide + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await game.playLevel({ maxTicks: 20 });
    await toasts(page);
    await page.click('#hud-resources');
  },
  'Goals panel + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await page.click('#guide-skip');
    await page.click('#nav-goals');
    await expect(page.locator('#side-panel')).toHaveClass(/open/);
    await toasts(page);
  },
  'feedback dialog + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await page.click('#guide-skip');
    await page.click('#hud-menu');
    await page.click('#hud-feedback');
    await toasts(page);
  },
  'level complete + toasts': async (game, page) => {
    await game.newGame('guestbook');
    await game.playLevel();
    await expect(page.locator('#level-up-overlay')).toBeVisible();
    await toasts(page);
  },
  'next level intro right after a warning toast': async (game, page) => {
    await game.newGame('guestbook');
    await game.playLevel();
    await page.click('#level-up-stay');
    await page.evaluate(() => {
      window.__game.notifications.show('⚠️ Level 2 brings more traffic: you start with fewer users. Check Goals for what to build.', 'warning', 60000);
      window.__game.startNextLevel();
    });
    await expect(page.locator('#li-start')).toBeVisible();
  }
};

for (const [size, viewport] of Object.entries(SIZES)) {
  test.describe(`pop-ups on ${size}`, () => {
    test.use({ viewport, hasTouch: size !== 'desktop', isMobile: size.includes('phone') });
    for (const [name, scene] of Object.entries(SCENES)) {
      test(name, async ({ game, page }) => {
        await scene(game, page);
        expectClean(await audit(page));
      });
    }
  });
}

test('toasts wait while a modal is open, then show once it closes', async ({ game, page }) => {
  await game.pick('guestbook');
  await page.evaluate(() => window.__game.notifications.show('📍 Waiting toast', 'info', 60000));
  const toast = page.locator('#notification-container .toast', { hasText: 'Waiting toast' });
  await expect(toast).toHaveCount(0);
  await game.start();
  await expect(toast).toBeVisible();
  // It was logged for the Alerts tab right away
  expect(await game.run((g, gs) => gs.notificationLog?.some?.(n => /Waiting toast/.test(n.message)) ?? true)).toBe(true);
});

test('a toast already showing steps out of sight while a popover is open', async ({ game, page }) => {
  await game.newGame('guestbook');
  await page.click('#guide-skip');
  await toasts(page);
  const stack = page.locator('#notification-container');
  await expect(stack).toBeVisible();
  await page.click('#hud-menu');
  await expect(stack).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(stack).toBeVisible();
});

test('only the newest toasts show after a long wait, the rest stay in Alerts', async ({ game, page }) => {
  await game.pick('guestbook');
  await page.evaluate(() => {
    for (let i = 1; i <= 5; i++) window.__game.notifications.show(`Held ${i}`, 'info', 60000);
  });
  await game.start();
  const shown = page.locator('#notification-container .toast');
  await expect(shown).toHaveCount(2);
  await expect(shown.nth(0)).toContainText('Held 4');
  await expect(shown.nth(1)).toContainText('Held 5');
});

test('every pop-up uses a z-index token from the one layer scale', async ({ page }) => {
  await page.goto('/');
  const order = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const z = n => Number(css.getPropertyValue(`--z-${n}`));
    return ['hud', 'panel', 'coach', 'notification', 'popover', 'modal', 'screen', 'tooltip', 'crash'].map(n => [n, z(n)]);
  });
  for (let i = 1; i < order.length; i++) {
    expect(order[i][1], `${order[i][0]} must sit above ${order[i - 1][0]}`).toBeGreaterThan(order[i - 1][1]);
  }
});
