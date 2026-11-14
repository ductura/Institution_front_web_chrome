import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: { command: 'node dev-server.mjs', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  projects: [
    // U CI-ju se koristi pravi Google Chrome (channel: 'chrome'); lokalno Chromium.
    { name: 'chrome', use: { ...devices['Desktop Chrome'], ...(process.env.CI ? { channel: 'chrome' } : {}) } },
  ],
});
