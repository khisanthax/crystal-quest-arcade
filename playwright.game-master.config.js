import {defineConfig} from '@playwright/test';

const port = Number(process.env.PW_GAME_MASTER_PORT || 42741);
const baseURL = 'http://localhost:' + port;
process.env.CQ_GAME_MASTER_TEST_KEY = 'disposable-game-master-test-key-2026';

export default defineConfig({
  testDir: './tests/admin',
  timeout: 180000,
  workers: 1,
  outputDir: 'test-results/game-master',
  use: {baseURL, viewport: {width: 1180, height: 820}, hasTouch: true, actionTimeout: 15000, trace: 'retain-on-failure'},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'webkit', use: {browserName: 'webkit'}}
  ],
  webServer: {
    command: 'node server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      CQ_DB_PATH: '.local/game-master-test-' + process.pid + '.sqlite',
      CQ_GAME_MASTER_KEY: process.env.CQ_GAME_MASTER_TEST_KEY,
      CQ_ADMIN_KEY: 'disposable-game-master-maintenance-test-key'
    }
  }
});
