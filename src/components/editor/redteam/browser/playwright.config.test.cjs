const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

// Red-team "AI tipkač". Harness run: `pnpm exec playwright test --config
// src/components/editor/redteam/browser/playwright.config.test.cjs`.
// Live run against a local/staging Ductura: set REDTEAM_URL (opens headed).
const live = Boolean(process.env.REDTEAM_URL);
const command = "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/redteam/browser/vite.config.test.mjs";

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /(redteam|kontrola|kanali|ispitni)\.spec\.ts$/,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: { baseURL: "http://127.0.0.1:5399", locale: "hr-HR", headless: !live },
  // kanali.spec.ts and ispitni.spec.ts use CDP and the clipboard: Chromium only, never in the live run.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: live ? /(kanali|ispitni)\.spec\.ts$/ : undefined },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /(kanali|ispitni)\.spec\.ts$/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /(kanali|ispitni)\.spec\.ts$/ },
  ],
  webServer: live ? undefined : { command, cwd: path.resolve(__dirname, "../../../../.."), url: "http://127.0.0.1:5399", timeout: 60_000 },
});
