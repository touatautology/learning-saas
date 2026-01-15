import { defineConfig } from '@playwright/test';

const serverPort = process.env.PLAYWRIGHT_PORT || process.env.PORT || '3002';
const webServerUrl =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: webServerUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    env: {
      PORT: serverPort,
      BASE_URL: webServerUrl,
      ENABLE_TEST_ENDPOINTS: 'true',
      SKIP_STRIPE_FETCH: 'true',
      NODE_ENV: 'test',
      BROWSERSLIST_IGNORE_OLD_DATA: '1',
    },
    url: webServerUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
