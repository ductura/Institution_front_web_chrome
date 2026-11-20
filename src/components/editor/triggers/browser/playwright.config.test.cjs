const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const command = 'pnpm --dir catalog exec vite --config ../src/components/editor/triggers/browser/vite.config.test.mjs';
module.exports = defineConfig({
  testDir: __dirname, testMatch: 'editor.spec.cjs', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5306' },
  webServer: { command, cwd: path.resolve(__dirname, '../../../../..'), url: 'http://127.0.0.1:5306', timeout: 30000 },
});
