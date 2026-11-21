const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "print-export.spec.cjs",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:5310" },
  webServer: {
    command: "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/print-export/browser/vite.config.test.mjs --host 127.0.0.1 --port 5310 --strictPort",
    cwd: path.resolve(__dirname, "../../../../.."),
    url: "http://127.0.0.1:5310/@vite/client",
  },
});
