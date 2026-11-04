import {defineConfig} from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 4175);
process.env.CQ_DB_PATH ??= '.local/playwright-' + process.pid + '.sqlite';
const ownerKey = process.env.PW_DISABLE_OWNER_KEY === '1' ? '' : 'disposable-playwright-workshop-owner-key';
process.env.CQ_GAME_MASTER_TEST_KEY = ownerKey;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  testIgnore: '**/admin/**',
  timeout: 420000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:' + port,
    viewport: {width: 1180, height: 820},
    hasTouch: true,
    deviceScaleFactor: 1,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'webkit', use: {browserName: 'webkit'}},
  ],
  webServer: {
    command: 'node server.mjs',
    env: {PORT: String(port), CQ_GAME_MASTER_KEY: ownerKey},
    port,
    reuseExistingServer: false,
  },
});
