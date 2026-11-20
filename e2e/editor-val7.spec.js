import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Same local stack and fictional AAI account as editor-val1.spec.js.
// Start Institution_server (pnpm lokalno --izravno) and this web (pnpm next:dev).
// DUCTURA_STOG=1 pnpm test:functional --project=chromium e2e/editor-val7.spec.js
const WEB = process.env.DUCTURA_STOG_WEB ?? 'http://localhost:3000';
const OIDC = new URL(process.env.DUCTURA_STOG_OIDC ?? 'http://localhost:8090').origin;
const ASSIGNMENT = 'Seminarski rad: kućno kompostiranje';
const SETTINGS = 'Stil citiranja i Lektin profil';
const SYNCED = 'Spremljeno na poslužitelju';

const editorOf = (page) => page.getByRole('textbox', { name: 'Tekst rada' });
const saveChipOf = (page) => page.locator('footer[aria-label="Stanje rada"]').getByRole('status').first();

async function openSeedWork(page) {
  await page.goto(`${WEB}/api/v1/auth/login?returnTo=%2F`);
  await expect(page).toHaveURL((url) => url.origin === OIDC);
  await page.locator('button[name="account"][value="demo-student"]').click();
  await page.waitForURL((url) => url.origin !== OIDC && !url.pathname.endsWith('/auth/callback'));
  const response = await page.request.get(`${WEB}/api/v1/student/assignments`);
  expect(response.ok(), 'GET /api/v1/student/assignments after fake AAI login').toBe(true);
  const { courses } = await response.json();
  const assignment = courses.flatMap((course) => course.assignments).find(({ title }) => title === ASSIGNMENT);
  expect(assignment, 'fictional seed assignment').toBeDefined();
  await page.goto(`${WEB}/rad/${assignment.id}`);
  await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
}

async function readCitationSettings(page) {
  const toolbar = page.getByRole('toolbar', { name: 'Oblikovanje teksta' });
  await toolbar.getByRole('button', { name: 'Prikaz', exact: true }).click();
  await toolbar.getByRole('menuitem', { name: SETTINGS, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: SETTINGS, exact: true });
  await expect(dialog.getByRole('term')).toHaveText(['Stil citiranja', 'Lektin profil']);
  const values = dialog.getByRole('definition');
  await expect(values).toHaveText([/\S/, /\S/]);
  const settings = await values.allTextContents();
  await dialog.getByRole('button', { name: 'Zatvori', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  return settings;
}

if (process.env.DUCTURA_STOG === '1') {
  test.describe('editor, val 7 na lokalnom stogu', () => {
    test.beforeEach(async ({ page }) => {
      await openSeedWork(page);
    });

    test('stil citiranja i Lektin profil prikazani su i nakon osvježavanja', async ({ page }) => {
      const settings = await readCitationSettings(page);
      await page.reload();
      await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
      expect(await readCitationSettings(page)).toEqual(settings);
    });

    test('oznaka iz naredbe /provjera ostaje nakon potvrđenog spremanja i osvježavanja', async ({ page }) => {
      const editor = editorOf(page);
      const text = `Izmišljeni odlomak ${randomUUID()}`;
      const markedText = `${text} [?]`;
      await editor.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.insertText(`${text} /provjera`);
      const option = page.getByRole('option', { name: /^\/provjera\b/ });
      await expect(option).toBeVisible();

      // Match this edit's snapshot so an earlier autosave cannot satisfy the check.
      await Promise.all([
        page.waitForResponse((response) => {
          const request = response.request();
          if (!response.ok() || request.method() !== 'POST' ||
              new URL(response.url()).pathname !== '/api/v1/evidence/commit') return false;
          const { document } = request.postDataJSON();
          return typeof document === 'string' && Buffer.from(document, 'base64').toString('utf8').includes(markedText);
        }),
        option.click(),
      ]);
      const paragraph = editor.getByText(markedText, { exact: true });
      await expect(paragraph).toBeVisible();
      await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });

      await page.reload();
      await expect(editor).toHaveAttribute('aria-readonly', 'false');
      await expect(paragraph).toBeVisible();
      await expect(saveChipOf(page)).toHaveText(SYNCED);
    });
  });
}
