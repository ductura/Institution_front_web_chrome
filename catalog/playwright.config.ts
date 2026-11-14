import { defineConfig, devices } from "@playwright/test";

// Visual and axe checks of the static catalogue (web.md §6 B5). Tolerances are
// Playwright's defaults with no mask, as in Ductus e2e/visual.spec.ts, until
// the plan sets a threshold of its own. Baselines are Linux Chromium.
export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure" },
  expect: { toHaveScreenshot: { animations: "disabled" } },
  webServer: {
    command: "pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
