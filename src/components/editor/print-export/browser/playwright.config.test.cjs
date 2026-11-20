const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "print-export.spec.cjs",
  use: { baseURL: "http://127.0.0.1:5310" },
  webServer: {
    command: "node catalog/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5310 --strictPort",
    cwd: path.resolve(__dirname, "../../../../.."),
    url: "http://127.0.0.1:5310/src/components/editor/print-export/browser/index.html",
  },
});
