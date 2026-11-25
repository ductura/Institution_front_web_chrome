import { defineConfig, devices } from "@playwright/test";

// DAN-1565: the real app over dev-server.mjs with the institution server
// faked per page (page.route), as in ../playwright.config.ts, on a port of
// its own. Not part of `test:e2e`: it writes a report and asserts no match.
const port = 5192;
export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  outputDir: "../test-results/reference-run",
  workers: 1,
  reporter: "line",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "off" },
  webServer: {
    command: "pnpm run build && node ../../dev-server.mjs",
    cwd: "..",
    env: { PORT: String(port), INSTITUTION_SERVER_URL: "http://127.0.0.1:9" },
    url: `http://127.0.0.1:${port}/app/web/`,
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
