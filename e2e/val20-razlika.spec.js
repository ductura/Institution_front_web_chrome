// WEB-V20-E2E (docs/nalazi/val20-razlika.md §3 t. 14): val 20 on the local stack with the fake AAI@EduHr.
// A made-up student (demo-student of the server's seed) turns on the dyslexia font and a reading mode, hears the work
// read aloud (fake speechSynthesis: pause, stop) and a foreign student gets 404. axe runs at 1250 and 400 px.
//
// Like editor-val7.spec.js it registers its tests only on the stack (DUCTURA_STOG=1); without it nothing here runs.
// Start the stack as in e2e/sistem/README.md (Institution_server, `pnpm build && pnpm start`, the Preloader's edge on
// :8000, STOG_EDGE_PORT if it is elsewhere), then:
//   DUCTURA_STOG=1 pnpm exec playwright test --project=chromium e2e/val20-razlika.spec.js
// The list of literature in the institution's style (step 3 of the task) is in val20-razlika-popis.spec.js.pending:
// StudentBibliographyHost is not mounted on any route yet (review of #713: no red test for an unmounted component).
import { expect, test } from '@playwright/test';

import { axe } from './support/axe.js';
import { app, webOrigin } from './sistem/stog.ts';
import { dismissGuide, signInDemoStudent } from './sistem/student.ts';

const ASSIGNMENT_TITLE = 'Seminarski rad: kućno kompostiranje';
const KEY = 'ductura.reading.v1';
const html = (page, attribute) => page.locator('html').getAttribute(attribute);

const editorOf = (page) => page.getByRole('textbox', { name: 'Tekst rada', exact: true });
const toolbarOf = (page) => page.getByRole('toolbar', { name: 'Oblikovanje teksta' });

/** The seed assignment's id, read from the server, never hard-coded. */
async function seedAssignmentId(page) {
  const response = await page.request.get('/api/v1/student/assignments');
  expect(response.status(), 'GET /api/v1/student/assignments').toBe(200);
  const { courses } = await response.json();
  const found = courses.flatMap((course) => course.assignments).find((a) => a.title === ASSIGNMENT_TITLE);
  expect(found, `the seed assignment „${ASSIGNMENT_TITLE}”`).toBeTruthy();
  return found.id;
}

async function openWork(page, id) {
  await page.goto(app(`/rad/${id}`));
  await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
  await dismissGuide(page);
}

/** A fake Web Speech API that records what the page asks of it (the real one speaks aloud, which a test cannot hear). */
async function fakeSpeech(page) {
  await page.addInitScript(() => {
    const log = { spoken: [], paused: 0, resumed: 0, cancelled: 0 };
    window.__speech = log;
    // speechSynthesis is a getter-only property in Chromium, so plain assignment would keep the real one.
    const define = (name, value) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
    define('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; } });
    // The utterance never ends by itself: the test decides when a reading stops. A Croatian voice exists, so no fallback notice.
    define('speechSynthesis', {
      speak(utterance) { log.spoken.push({ text: utterance.text, rate: utterance.rate }); setTimeout(() => utterance.onstart?.(), 0); },
      pause() { log.paused += 1; },
      resume() { log.resumed += 1; },
      cancel() { log.cancelled += 1; },
      getVoices: () => [{ lang: 'hr-HR', name: 'Izmišljeni hrvatski glas', voiceURI: 'izmisljeni-hr', default: true }],
    });
  });
}

async function openReadingSettings(page) {
  await toolbarOf(page).getByRole('button', { name: 'Prikaz', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Prikaz i čitanje', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Prikaz i čitanje', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

const pressed = (scope, group, name) => scope.getByRole('group', { name: group, exact: true }).getByRole('button', { name, exact: true });

if (process.env.DUCTURA_STOG === '1') {
  test.describe('val 20: čitanje i prikaz na lokalnom stogu', () => {
    test.use({ baseURL: webOrigin });
    let assignmentId;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({ baseURL: webOrigin });
      const page = await context.newPage();
      await signInDemoStudent(page);
      assignmentId = await seedAssignmentId(page);
      await context.close();
    });

    test.beforeEach(async ({ page }) => {
      await signInDemoStudent(page);
    });

    test('font za disleksiju i način čitanja ostaju nakon osvježavanja, a "Zadano" ih vraća', async ({ page }) => {
      await openWork(page, assignmentId);
      // Negative first: with nothing chosen the attributes carry the defaults, so the next checks cannot pass vacuously.
      expect(await html(page, 'data-reading-font')).not.toBe('dyslexia');
      const standardFont = await editorOf(page).evaluate((el) => getComputedStyle(el).fontFamily);

      const dialog = await openReadingSettings(page);
      await pressed(dialog, 'Font teksta rada', 'Za disleksiju').click();
      await pressed(dialog, 'Širina retka', 'Uža').click();
      await pressed(dialog, 'Razmak redaka', 'Veći').click();
      await expect(page.locator('html')).toHaveAttribute('data-reading-font', 'dyslexia');
      await expect(page.locator('html')).toHaveAttribute('data-reading-width', 'narrow');
      await expect(page.locator('html')).toHaveAttribute('data-reading-line-height', 'relaxed');
      expect(await editorOf(page).evaluate((el) => getComputedStyle(el).fontFamily), 'font teksta rada se promijenio').not.toBe(standardFont);
      // Browser only: the choice is in localStorage and no request carries it to the server.
      expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), KEY))).toMatchObject({ font: 'dyslexia', width: 'narrow', lineHeight: 'relaxed' });
      await dialog.getByRole('button', { name: 'Gotovo', exact: true }).click();

      await page.reload();
      await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
      await dismissGuide(page);
      await expect(page.locator('html')).toHaveAttribute('data-reading-font', 'dyslexia');
      await expect(page.locator('html')).toHaveAttribute('data-reading-width', 'narrow');
      await expect(page.locator('html')).toHaveAttribute('data-reading-line-height', 'relaxed');

      const again = await openReadingSettings(page);
      await again.getByRole('button', { name: 'Zadano', exact: true }).click();
      await expect(again.getByRole('status')).toHaveText('Prikaz i čitanje vraćeni su na zadano.');
      await expect(page.locator('html')).toHaveAttribute('data-reading-font', 'standard');
      await expect(page.locator('html')).toHaveAttribute('data-reading-width', 'standard');
      await expect(page.locator('html')).toHaveAttribute('data-reading-line-height', 'standard');
    });

    test('čitanje naglas: čita rad, pauza, nastavak i stani', async ({ page }) => {
      await fakeSpeech(page);
      await openWork(page, assignmentId);
      const menu = toolbarOf(page).getByRole('button', { name: /^Čitaj naglas/ });
      const live = page.getByRole('status').filter({ hasText: /Čitanje/ });

      await menu.click();
      await page.getByRole('menuitem', { name: 'Čitaj rad', exact: true }).click();
      await expect(live).toHaveText('Čitanje u tijeku');
      const spoken = await page.evaluate(() => window.__speech.spoken);
      expect(spoken.length, 'preglednik je dobio tekst za čitanje').toBeGreaterThan(0);
      expect(spoken[0].text.trim()).not.toBe('');

      await menu.click();
      await page.getByRole('menuitem', { name: 'Pauza', exact: true }).click();
      await expect(live).toHaveText('Čitanje je na pauzi');
      expect(await page.evaluate(() => window.__speech.paused)).toBe(1);

      // Starting a reading also wakes the synthesiser (controller.ts), so count the increment made by "Nastavi".
      const resumedBefore = await page.evaluate(() => window.__speech.resumed);
      await menu.click();
      await page.getByRole('menuitem', { name: 'Nastavi', exact: true }).click();
      await expect(live).toHaveText('Čitanje u tijeku');
      expect(await page.evaluate(() => window.__speech.resumed)).toBe(resumedBefore + 1);

      await menu.click();
      await page.getByRole('menuitem', { name: 'Zaustavi čitanje', exact: true }).click();
      await expect(live).toHaveText('Čitanje je zaustavljeno');
      expect(await page.evaluate(() => window.__speech.cancelled)).toBeGreaterThan(0);
      // Escape stops a reading as well, and reading never edits the work.
      await menu.click();
      await page.getByRole('menuitem', { name: 'Čitaj rad', exact: true }).click();
      await expect(live).toHaveText('Čitanje u tijeku');
      await editorOf(page).focus();
      await page.keyboard.press('Escape');
      await expect(live).toHaveText('Čitanje je zaustavljeno');
    });

    test('preglednik bez čitanja naglas: poruka, ne greška', async ({ page }) => {
      await page.addInitScript(() => {
        for (const name of ['speechSynthesis', 'SpeechSynthesisUtterance']) Object.defineProperty(window, name, { value: undefined, configurable: true });
      });
      await openWork(page, assignmentId);
      await toolbarOf(page).getByRole('button', { name: /^Čitaj naglas/ }).click();
      const item = page.getByRole('menuitem', { name: 'Čitaj rad', exact: true });
      await expect(item).toBeDisabled();
    });

    test('axe: ready editor with the settings dialog open, at 1250 and 400 px', async ({ page }) => {
      for (const width of [1250, 400]) {
        await page.setViewportSize({ width, height: 900 });
        await openWork(page, assignmentId);
        await axe(page);
        const dialog = await openReadingSettings(page);
        await pressed(dialog, 'Font teksta rada', 'Za disleksiju').click();
        await axe(page);
        await dialog.getByRole('button', { name: 'Zadano', exact: true }).click();
        await dialog.getByRole('button', { name: 'Gotovo', exact: true }).click();
      }
    });

    test('tuđi rad je nepostojeći: drugi student dobiva 404 za konfiguraciju stila', async ({ browser }) => {
      const otherContext = await browser.newContext({ baseURL: webOrigin });
      try {
        const other = await otherContext.newPage();
        await signInDemoStudent(other, 'demo-student-2');
        const foreign = await other.request.get(`/api/v1/student/assignments/${assignmentId}/text-check-config`);
        const missing = await other.request.get('/api/v1/student/assignments/00000000-0000-4000-8000-000000000000/text-check-config');
        // A foreign and an unknown id answer the same way: nothing tells the student the foreign one exists.
        expect(missing.status()).toBe(404);
        expect(foreign.status()).toBe(404);
        // The page of a foreign work does not open an editor either.
        await other.goto(app(`/rad/${assignmentId}`));
        await expect(editorOf(other)).toHaveCount(0);
      } finally {
        await otherContext.close();
      }
    });
  });
}
