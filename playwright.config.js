const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  workers: 2,
  updateSnapshots: 'none',
  // Windows desktop and Windows Server runners render text/scroll extents with
  // small differences despite the same pinned Chromium and local font files.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.04 } },
  use: {
    browserName: 'chromium',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});
