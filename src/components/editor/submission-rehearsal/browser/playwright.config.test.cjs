const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "rehearsal.spec.cjs",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5311" },
  webServer: {
    command: "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/submission-rehearsal/browser/vite.config.test.mjs --host 127.0.0.1 --port 5311 --strictPort",
    cwd: path.resolve(__dirname, "../../../../.."),
    url: "http://127.0.0.1:5311/src/components/editor/submission-rehearsal/browser/fixture.spec.tsx",
  },
});
