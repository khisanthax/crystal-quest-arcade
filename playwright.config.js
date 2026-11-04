import {defineConfig} from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 4175);
process.env.CQ_DB_PATH ??= '.local/playwright-' + process.pid + '.sqlite';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 420000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:' + port,
    viewport: {width: 1180, height: 820},
    hasTouch: true,
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'webkit', use: {browserName: 'webkit'}},
  ],
  webServer: {
    command: 'node server.mjs',
    env: {PORT: String(port)},
    port,
    reuseExistingServer: false,
  },
});
