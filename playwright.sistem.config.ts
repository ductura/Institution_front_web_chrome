import { defineConfig, devices } from '@playwright/test';

import { webOrigin } from './e2e/sistem/stog';

export default defineConfig({
  testDir: './e2e/sistem',
  // Ovaj sufiks ostavlja sistemske testove izvan postojeće funkcionalne matrice.
  testMatch: '**/*.sistem.ts',
  globalSetup: './e2e/sistem/stog.ts',
  outputDir: './test-results/sistem',
  workers: 1,
  timeout: 90_000,
  use: { ...devices['Desktop Chrome'], baseURL: webOrigin, trace: 'retain-on-failure' },
});
