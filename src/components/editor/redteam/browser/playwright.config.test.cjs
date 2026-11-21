const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

// Red-team "AI tipkač". Harness run: `pnpm exec playwright test --config
// src/components/editor/redteam/browser/playwright.config.test.cjs`.
// Live run against a local/staging Ductura: set REDTEAM_URL (opens headed).
const live = Boolean(process.env.REDTEAM_URL);
const command = "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/redteam/browser/vite.config.test.mjs";

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /(redteam|kontrola)\.spec\.ts$/,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: { baseURL: "http://127.0.0.1:5399", locale: "hr-HR", headless: !live },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: live ? undefined : { command, cwd: path.resolve(__dirname, "../../../../.."), url: "http://127.0.0.1:5399", timeout: 60_000 },
});
