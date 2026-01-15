import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    env: {
      PORT: '3002',
      ENABLE_TEST_ENDPOINTS: 'true',
      SKIP_STRIPE_FETCH: 'true',
      NODE_ENV: 'test',
      BROWSERSLIST_IGNORE_OLD_DATA: '1',
    },
    url: process.env.BASE_URL || 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
