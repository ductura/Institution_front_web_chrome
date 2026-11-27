import { defineConfig, devices } from "@playwright/test";

// The host of the institution front on `next start` (#2028 c.6993786629 §1,
// §3.3). The institution server is faked per test with page.route, so no
// request leaves the browser; the port is its own, apart from the root e2e.
const port = 5191;
const ci = Boolean(process.env.CI);
// The fake institution server: nothing listens on port 9. The rewrites read it
// when the app is built (src/rewrites.ts), so the CI step Build sets the same.
const institutionServer = "http://127.0.0.1:9";
const start = `pnpm exec next start --hostname 127.0.0.1 -p ${port}`;
export default defineConfig({
  // e2e: the flows; tests/mobile: the 360 px view of the main screens (WEB-1806).
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "tests/mobile/**/*.spec.ts"],
  retries: ci ? 1 : 0,
  // Every test has its own browser context and its own page.route fake, and
  // reads fixtures only; `next start` keeps no state between requests. So
  // tests do not share state and run in parallel, also within a file (ZEL-CI-WEB).
  // Three workers leave one of the runner's four cores to `next start`.
  fullyParallel: true,
  workers: ci ? 3 : 1,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    // In CI the step Build has built the app (with the same server URL), so
    // the server only starts it; locally the build stays in the command.
    command: ci ? start : `pnpm run build && ${start}`,
    env: { INSTITUTION_SERVER_URL: institutionServer },
    url: `http://127.0.0.1:${port}/aplikacija/`,
    reuseExistingServer: !ci,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
