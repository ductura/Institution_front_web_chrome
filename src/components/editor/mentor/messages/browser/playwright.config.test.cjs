const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const baseURL = "http://127.0.0.1:5311";

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "mentor.spec.cjs",
  workers: 1,
  use: { baseURL },
  webServer: {
    command: "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/mentor/messages/browser/vite.config.test.mjs --host 127.0.0.1 --port 5311 --strictPort",
    cwd: path.resolve(__dirname, "../../../../../.."),
    url: `${baseURL}/src/components/editor/mentor/messages/browser/fixture.spec.tsx`,
  },
});
