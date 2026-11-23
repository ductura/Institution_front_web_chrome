import { defineConfig, devices } from "@playwright/test";

// VIZ alat (graditelj): the app beside its prototype at 390, 768, 1100 and
// 1280 px (e2e/viz). A report for the graditelj, not a test: not in CI.
// VIZ_URL reuses a running host (e.g. http://127.0.0.1:5173 of `pnpm dev`),
// so the screens are shot without a build; without it the host is built once.
const port = 5192;
const url = process.env.VIZ_URL;
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.viz.ts",
  outputDir: "../../test-results/viz",
  workers: 1,
  reporter: "line",
  globalTeardown: "./izvjestaj.ts",
  use: { baseURL: url ?? `http://127.0.0.1:${port}`, ...devices["Desktop Chrome"] },
  webServer: url ? undefined : {
    // Playwright runs the command in the config directory (e2e/viz) unless
    // told otherwise; the host builds and starts from packages/app.
    cwd: "../..",
    command: `pnpm run build && pnpm exec next start -p ${port}`,
    env: { INSTITUTION_SERVER_URL: "http://127.0.0.1:9" },
    url: `http://127.0.0.1:${port}/app/web/`,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
