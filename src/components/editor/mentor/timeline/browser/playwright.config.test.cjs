const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const baseURL = "http://127.0.0.1:5411";
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "work-timeline.spec.cjs",
  workers: 1,
  use: { baseURL },
  webServer: {
    command: "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/mentor/messages/browser/vite.config.test.mjs --host 127.0.0.1 --port 5411 --strictPort",
    cwd: path.resolve(__dirname, "../../../../../.."),
    url: `${baseURL}/src/components/editor/mentor/timeline/browser/fixture.spec.tsx`,
    timeout: 120000,
  },
});
