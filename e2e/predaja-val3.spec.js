// WEB-28 predaja-e2e (Ductus#2028 c.7009405737): the "Prihvaćanje" steps of
// WEB-23..WEB-27 clicked on the local stack as `demo-student`: work → declaration
// → before submit (with a note) → submit → receipt → refresh, with axe at 1250
// and 400 px and a case with the network switched off on step 4. Only made-up
// data from the server's seed (SRV-17), never real names or texts.
//
// Like editor-val1.spec.js these tests need the whole local stack, so they are
// registered only with DUCTURA_STOG=1 (without it they do not exist, rather than
// being skipped). To run them:
//
//   1. Institution_server: `pnpm lokalno --izravno` (server :4000, fake OIDC
//      :8090, PostgreSQL with the seed). Start from a fresh seed: a submission
//      cannot be undone, so a second run on the same database fails at the
//      first test with a message saying so.
//   2. This repo: `pnpm next:dev` (:3000).
//   3. `DUCTURA_STOG=1 pnpm test:functional --project=chromium e2e/predaja-val3.spec.js`
//
// Everything is opened on `localhost`, never `127.0.0.1` (the session cookie
// belongs to the host the callback set it on). Chromium is the column this was
// written for.
//
// Not covered, by decision: "praznine u zapisu" (P-3, no way to make a gap from
// the public API; the unit tests of ReceiptPanel hold that variant), the receipt
// signature (P-4, the browser checks only the shape).
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';

const WEB = process.env.DUCTURA_STOG_WEB ?? 'http://localhost:3000';
const OIDC = process.env.DUCTURA_STOG_OIDC ?? 'http://localhost:8090';
const STUDENT = 'demo-student';
const ASSIGNMENT_TITLE = 'Seminarski rad: kućno kompostiranje';

// Texts as the pages show them (src/lib/i18n/messages.hr.ts, packages/ui).
const SYNCED = 'Spremljeno na poslužitelju';
const FINGERPRINT_COPIED = 'Otisak je u međuspremniku (64 znaka, bez razmaka).';
const OFFLINE_ON_SUBMIT = 'Nema mreže. Predaja čeka da se mreža vrati.';
const SIGNED_NOTE = 'Kod potvrđuje da se predani tekst nije mijenjao od predaje.';
// The digest is hex; the case is the server's (Fingerprint accepts either).
const SHA256_HEX = /^[0-9a-f]{64}$/i;

/** Fails at once with what to start, instead of each test timing out. */
async function reachable(url, what) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
  } catch (error) {
    throw new Error(`${what} se ne javlja na ${url} (${error.message}); vidi zaglavlje datoteke.`);
  }
}

/** Signs in as a seed account through the web's /api/v1 and the fake OIDC page. */
async function signIn(page, account) {
  await page.goto(`${WEB}/api/v1/auth/login?returnTo=${encodeURIComponent('/')}`);
  await expect(page).toHaveURL((url) => url.origin === new URL(OIDC).origin);
  await page.locator(`button[name="account"][value="${account}"]`).click();
  await page.waitForURL((url) => url.origin !== new URL(OIDC).origin && !url.pathname.endsWith('/auth/callback'));
  const me = await page.request.get(`${WEB}/api/v1/me`);
  expect(me.status(), 'GET /api/v1/me after sign-in').toBe(200);
}

/** The seed assignment's id, read from student.assignments.get, never hard-coded. */
async function seedAssignmentId(page) {
  const response = await page.request.get(`${WEB}/api/v1/student/assignments`);
  expect(response.status(), 'GET /api/v1/student/assignments').toBe(200);
  const { courses } = await response.json();
  const found = courses.flatMap((course) => course.assignments).find((a) => a.title === ASSIGNMENT_TITLE);
  expect(found, `the seed assignment „${ASSIGNMENT_TITLE}”`).toBeTruthy();
  return found.id;
}

const editorOf = (page) => page.getByRole('textbox', { name: 'Tekst rada' });
const saveChipOf = (page) => page.locator('footer[aria-label="Stanje rada"]').getByRole('status').first();
const heading = (page, name) => page.getByRole('heading', { level: 1, name, exact: true });
const step = (page, id, name) => page.waitForURL(`${WEB}/rad/${id}/predaja/${name}`);

/** The digest as the receipt shows it: groups of four, joined without spaces. */
async function shownFingerprint(page) {
  const groups = await page.locator('code span').allTextContents();
  return groups.join('');
}

if (process.env.DUCTURA_STOG === '1') {
  // One flow, one submission: the tests run in this order on one account and
  // one assignment, each building on the one before.
  test.describe.serial('predaja studenta, val 3 (WEB-23..WEB-27) na lokalnom stogu', () => {
    let assignmentId;
    let page;
    let text;
    let fingerprint;

    test.beforeAll(async ({ browser }) => {
      await reachable(`${WEB}/`, 'Next (pnpm next:dev)');
      await reachable(`${OIDC}/`, 'Lažni OIDC (pnpm lokalno)');
      await reachable(`${WEB}/api/v1/health`, 'Institution_server kroz /api/v1');
      const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
      page = await context.newPage();
      await signIn(page, STUDENT);
      assignmentId = await seedAssignmentId(page);
      text = `Izmišljeni odlomak za predaju ${test.info().project.name} ${Date.now()}`;
    });

    test.afterAll(async () => {
      await page.context().close();
    });

    test('rad: tekst stiže na poslužitelj, poveznica vodi na izjavu', async () => {
      await page.goto(`${WEB}/rad/${assignmentId}`);
      await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
      await editorOf(page).click();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type(text);
      await expect(editorOf(page)).toContainText(text);
      await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });

      await page.getByRole('link', { name: 'Predaja rada', exact: true }).click();
      // A submitted work would open on the receipt: the run needs a fresh seed.
      await page.waitForURL(/\/predaja\/(izjava|potvrda)$/);
      expect(page.url(), 'rad je već predan; pokreni na svježem seedu (vidi zaglavlje)').toMatch(/\/predaja\/izjava$/);
      await expect(heading(page, 'Izjava')).toBeVisible();
    });

    test('izjava: Dalje je zaključano do potvrde, potvrda otvara korak prije predaje', async () => {
      await expect(page.getByRole('button', { name: 'Dalje', exact: true })).toBeDisabled();
      await page.getByRole('checkbox', { name: 'Potvrđujem izjavu' }).check();
      await expect(page.getByRole('button', { name: 'Dalje', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Dalje', exact: true }).click();
      await step(page, assignmentId, 'pregled');
      await expect(heading(page, 'Prije predaje')).toBeVisible();
      await expect(page.getByText('Potvrđena.')).toBeVisible();
    });

    test('prije predaje: napomena se dodaje i ostaje na popisu', async () => {
      const note = `Izmišljena napomena ${Date.now()}`;
      await page.getByRole('button', { name: 'Dodaj napomenu (nije obavezna)' }).click();
      const dialog = page.getByRole('dialog', { name: 'Napomena uz predaju' });
      await dialog.getByLabel('Napomena').fill(note);
      await dialog.getByRole('button', { name: 'Dodaj napomenu', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('listitem').filter({ hasText: note })).toHaveCount(1);
      // Lijepljenja, praznine i oblik nikad ne zaustavljaju predaju (§5 pravilo 11).
      await expect(page.getByRole('button', { name: 'Dalje na predaju' })).toBeEnabled();
    });

    for (const width of [1250, 400]) {
      test(`axe bez nalaza na koraku prije predaje na ${width} px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await expect(heading(page, 'Prije predaje')).toBeVisible();
        await axe(page);
      });
    }

    test('predaja bez mreže: čeka mrežu i nikad ne kaže „predano”', async () => {
      await page.setViewportSize({ width: 1250, height: 900 });
      await page.getByRole('button', { name: 'Dalje na predaju' }).click();
      await step(page, assignmentId, 'slanje');
      await expect(heading(page, 'Predaja')).toBeVisible();
      await expect(page.getByText(text)).toBeVisible();

      await page.context().setOffline(true);
      // The text stands twice (the status line and the hint of the button).
      await expect(page.getByText(OFFLINE_ON_SUBMIT).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Predaj rad', exact: true })).toBeDisabled();
      await expect(page.getByText(/Potvrda predaje|predano/i)).toHaveCount(0);

      await page.context().setOffline(false);
      await expect(page.getByText(OFFLINE_ON_SUBMIT)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Predaj rad', exact: true })).toBeEnabled();
    });

    test('predaja: „Šalje se…” do odgovora, zatim potvrda s otiskom', async () => {
      await page.getByRole('button', { name: 'Predaj rad', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Predati rad?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Predaj rad', exact: true }).click();

      // B-6: the receipt (and "predano") only after the server answered.
      await step(page, assignmentId, 'potvrda');
      await expect(heading(page, 'Potvrda predaje')).toBeVisible();
      await expect(page.getByText(SIGNED_NOTE)).toBeVisible();
      fingerprint = await shownFingerprint(page);
      expect(fingerprint).toMatch(SHA256_HEX);
    });

    test('potvrda: otisak ide u međuspremnik kao 64 znaka bez razmaka', async () => {
      await page.getByRole('button', { name: 'Otisak u međuspremnik' }).click();
      await expect(page.getByText(FINGERPRINT_COPIED)).toBeVisible();
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboard).toBe(fingerprint);
    });

    test('osvježavanje: ista potvrda s istim otiskom', async () => {
      await page.reload();
      await expect(heading(page, 'Potvrda predaje')).toBeVisible();
      expect(await shownFingerprint(page)).toBe(fingerprint);
      // Opening the submission again lands on the same receipt, not on step 2.
      await page.goto(`${WEB}/rad/${assignmentId}/predaja`);
      await step(page, assignmentId, 'potvrda');
      expect(await shownFingerprint(page)).toBe(fingerprint);
    });

    for (const width of [1250, 400]) {
      test(`axe bez nalaza na potvrdi na ${width} px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await expect(heading(page, 'Potvrda predaje')).toBeVisible();
        await axe(page);
      });
    }
  });
}
