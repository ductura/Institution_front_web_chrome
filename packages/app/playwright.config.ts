import { defineConfig, devices } from "@playwright/test";

// The host of the institution front over dev-server.mjs (#2028 c.6993786629
// §1, §3.3). The institution server is faked per test with page.route, so no
// request leaves the browser; the port is its own, apart from the root e2e.
const port = 5191;
export default defineConfig({
  testDir: "./e2e",
  // The reference report (DAN-1565) is a command of its own, not a test of this run.
  testIgnore: "**/reference-report/**",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm run build && node ../../dev-server.mjs`,
    env: { PORT: String(port), INSTITUTION_SERVER_URL: "http://127.0.0.1:9" },
    url: `http://127.0.0.1:${port}/app/web/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
