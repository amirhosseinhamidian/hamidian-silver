import { defineConfig, devices } from '@playwright/test';

const storefrontOrigin = 'http://localhost:4310';
const mockApiOrigin = 'http://127.0.0.1:4311';
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || 'chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: storefrontOrigin,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/support/mock-commerce-api.mjs',
      url: `${mockApiOrigin}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev --hostname localhost --port 4310',
      url: `${storefrontOrigin}/products/silver-ring`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        HAMIDIAN_API_ORIGIN: mockApiOrigin,
        MEDIA_PUBLIC_BASE_URL: `${mockApiOrigin}/media`,
        STOREFRONT_PUBLIC_ORIGIN: storefrontOrigin,
        STOREFRONT_E2E: 'true',
        STOREFRONT_E2E_ALLOW_LOCAL_MEDIA: 'true',
        NEXT_PUBLIC_GA_MEASUREMENT_ID: '',
      },
    },
  ],
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'Tablet Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel,
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'], channel: browserChannel },
    },
  ],
});
