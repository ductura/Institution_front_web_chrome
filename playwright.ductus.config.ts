import { defineConfig, devices } from "@playwright/test";

// The e2e suites copied verbatim from Ductus 0cdb0f1f (e2e-ductus/). They are
// kept out of the default run (playwright.config.js, testDir ./e2e) because
// they target the Ductus Next server with its database and fake OIDC, which
// this repo does not start. Run them with `npm run test:e2e:ductus` against a
// running server: DUCTUS_E2E_BASE_URL (default http://localhost:3000).
// login/** had its own config in Ductus (playwright.login.config.ts) and its
// *.test.ts files there are vitest tests, so only *.spec.ts outside login run.
export default defineConfig({
  testDir: "./e2e-ductus",
  testMatch: "**/*.spec.ts",
  testIgnore: "login/**",
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.DUCTUS_E2E_BASE_URL ?? "http://localhost:3000",
    locale: "hr-HR",
    timezoneId: "Europe/Zagreb",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
