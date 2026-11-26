const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "print-export.spec.cjs",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5310",
    // Chromium reduces a non-ASCII download name ("Izmišljeni rad.docx") to "download" under the C/POSIX locale.
    launchOptions: { env: { ...process.env, LC_ALL: "C.UTF-8", LANG: "C.UTF-8" } },
  },
  webServer: {
    command: "node catalog/node_modules/vite/bin/vite.js --config src/components/editor/print-export/browser/vite.config.test.mjs --host 127.0.0.1 --port 5310 --strictPort",
    cwd: path.resolve(__dirname, "../../../../.."),
    url: "http://127.0.0.1:5310/@vite/client",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
