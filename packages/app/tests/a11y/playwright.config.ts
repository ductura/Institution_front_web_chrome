import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

// The accessibility pass of the institution front (WEB-1805, M11.6): the app on
// `next start`, its own port, the institution server faked per test with
// page.route, so no request leaves the browser.
const port = 5192;
export default defineConfig({
  testDir: ".",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm run build && pnpm exec next start -p ${port}`,
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env: { INSTITUTION_SERVER_URL: "http://127.0.0.1:9" },
    url: `http://127.0.0.1:${port}/app/web/stanje`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
