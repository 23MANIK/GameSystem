// Browser tests for Scale Architect (tests/e2e). Run with:  npx playwright test
// Every test gets its own browser context, so saves (localStorage) never mix
// and tests run in parallel. The game is served by tools/static-server.mjs.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 8123);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: process.env.E2E_WORKERS || '75%',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {})
  },
  webServer: {
    command: `node tools/static-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore'
  }
});
