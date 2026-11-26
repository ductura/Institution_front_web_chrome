import { defineConfig, devices } from '@playwright/test';

// e2e matrica (DAN-755, docs/plan/PLAN-MIGRACIJE.md §6 i §8 t. 16): isti scenariji u svakom stupcu.
// CI znači da je CI postavljen i neprazan (Playwrightova konvencija).
const ci = Boolean(process.env.CI);
// Pravi Chrome i Edge traže instalirane preglednike: CI ih instalira i tada su
// obvezni (nedostajući preglednik ruši posao). Lokalno ih uključuje
// DUCTURA_BRANDED=1; inače se ta dva projekta ne registriraju (nema preskakanja).
const branded = ci || process.env.DUCTURA_BRANDED === '1';

// Na pull requestu CI vrti tri motora preglednika: chromium, firefox i webkit
// (PM2-R13, plan M0.3: obvezna provjera na svakom PR-u). Pravi Chrome i Edge te
// mobilna i tablet emulacija ostaju na pushu na bazu i main te na noćnom
// rasporedu. Bez varijable matrica je cijela.
const PR_ENGINES = ['chromium', 'firefox', 'webkit'];
const prEngines = process.env.DUCTURA_PR_ENGINES === 'true';

const matrix = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'chrome', branded: true, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'edge', branded: true, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  { name: 'mobile-pixel-7', use: { ...devices['Pixel 7'] } },
  { name: 'mobile-iphone-14', use: { ...devices['iPhone 14'] } },
  { name: 'tablet-ipad', use: { ...devices['iPad (gen 7)'] } },
  { name: 'tablet-ipad-landscape', use: { ...devices['iPad (gen 7) landscape'] } },
];

export default defineConfig({
  testDir: './e2e',
  retries: ci ? 1 : 0,
  forbidOnly: ci,
  // Svi stupci dijele jedan memorijski oponašatelj API-ja i isti dokument,
  // pa se izvode jedan po jedan da jedan drugome ne prepišu tekst.
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: { command: 'node dev-server.mjs', url: 'http://127.0.0.1:5173', reuseExistingServer: !ci },
  projects: matrix.filter((p) => (branded || !p.branded) && (!prEngines || PR_ENGINES.includes(p.name))).map(({ name, use }) => ({ name, use })),
});
