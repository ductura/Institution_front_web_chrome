// WEB-V21-E2E (val21-razlika.md §5, zadatak 14): the whole STEM flow of wave 21 clicked on the local stack as
// invented users of the fake AAI@EduHr (D-09): the teacher writes code tests for the assignment; the student
// inserts a formula and a code block, reloads (the text is on the server, read in a fresh browser context), imports
// an invented notebook (the HTML output is discarded), runs the tests (one passes, one fails) and submits; the
// teacher opens the submitted version and sees the formula and the code. Somebody else's assignment, somebody else's
// work and an unknown id are 404 ("nije dostupno"). axe at 1250 and 400 px on the student's work and the teacher's
// pages. No test.fixme and no skip.
//
// Like editor-val1 and nastavnik-val5, the file needs the whole local stack, so its tests are registered only with
// DUCTURA_STOG=1 (without it they do not exist, rather than being skipped). The stack is the one of
// e2e/sistem/README.md: Institution_server (`pnpm lokalno --izvor=http://localhost:8000`), `pnpm build && pnpm start`
// of this repo and the Preloader's edge on :8000 (STOG_EDGE_PORT for another port):
//
//   DUCTURA_STOG=1 pnpm exec playwright test --project=chromium e2e/val21-razlika.spec.js
//
// Precondition (checked by the first student test, which fails with the reason rather than skipping): the demo work
// of `demo-student` is a v4 work (revision 0 with schemaVersion 4, SRV-10E) in an area that offers the tool
// `formula`. The regular seed makes v1 works; a v4 work needs its own seed row (see the PR, "Otvoreno").
// The submission is irreversible, so a second run needs a fresh seed (as in nastavnik-val5).
//
// Texts are those of packages/app (host/editor/formula, code-block, code-run, import, teacher/submissions,
// teacher/code-tests). Only invented names and texts.
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';
import { app, webOrigin } from './sistem/stog';
import { dismissGuide, openDemoAssignment, signInThroughPreloader } from './sistem/student';

const ASSIGNMENT_TITLE = 'Seminarski rad: kućno kompostiranje';
const FORMULA = String.raw`\frac{a}{b}`;
const CODE = 'function solve(n) { return n * 2; }';
const CAPTION = 'Udvostručenje (izmišljeni primjer)';
// Invented tests: the first passes with CODE, the second fails (CODE returns 6, not 7).
const TESTS = [
  { id: 'dvostruko', title: 'Dvostruko od 2', input: 2, expected: 4 },
  { id: 'krivo', title: 'Dvostruko od 3 (namjerno krivo očekivanje)', input: 3, expected: 7 },
];
const NOTEBOOK = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { kernelspec: { name: 'javascript', display_name: 'JavaScript', language: 'javascript' } },
  cells: [
    { cell_type: 'markdown', metadata: {}, source: ['Izmišljena bilježnica o kompostu <script>alert(1)</script>'] },
    {
      cell_type: 'code', metadata: {}, execution_count: 1, source: ['const kompost = 3;\n', 'kompost * 2'],
      outputs: [
        { output_type: 'stream', name: 'stdout', text: ['Izmišljeni ispis\n'] },
        { output_type: 'display_data', data: { 'text/html': ['<b>HTML izlaz se odbacuje</b>'] }, metadata: {} },
      ],
    },
  ],
};

const SAVED_ON_SERVER = 'Spremljeno na poslužitelju';
const editorOf = (page) => page.getByRole('textbox', { name: 'Tekst rada', exact: true });
const toolbarOf = (page) => page.getByRole('toolbar', { name: 'Oblikovanje teksta' });
const saveChipOf = (page) => page.locator('footer[aria-label="Stanje rada"]').locator('[data-tone]').first();
const sameOrigin = { origin: webOrigin };

/** Signs in as an account of the fake AAI@EduHr that has a button on its page. */
async function signedInPage(browser, account) {
  const context = await browser.newContext({ baseURL: webOrigin });
  const page = await context.newPage();
  await signInThroughPreloader(page, account);
  return { context, page };
}

/** Opens a menu of the toolbar ("Umetni") and chooses an item. */
async function chooseFromMenu(page, menu, item) {
  await toolbarOf(page).getByRole('button', { name: menu, exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

async function openWork(page, id) {
  await page.goto(app(`/rad/${id}`));
  await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
  await dismissGuide(page);
}

if (process.env.DUCTURA_STOG === '1') {
  test.use({ baseURL: webOrigin });
  test.describe.configure({ mode: 'serial' });

  test.describe('val 21: formula, blok koda, bilježnica i pokretanje testova (WEB-V21-E2E)', () => {
    let assignmentId;

    test.beforeAll(async ({ browser }) => {
      const { context, page } = await signedInPage(browser, 'demo-student');
      try {
        await expect(page).toHaveURL(new RegExp(`^${webOrigin}${app('/zadaci')}`));
        assignmentId = (await openDemoAssignment(page)).assignmentId;
      } finally {
        await context.close();
      }
    });

    test('nastavnik zapisuje testove uz zadatak i vidi ih u obrascu; tuđi i nepoznat zadatak su 404', async ({ browser }) => {
      const teacher = await signedInPage(browser, 'demo-teacher');
      const other = await signedInPage(browser, 'demo-teacher-2');
      try {
        const put = await teacher.page.request.put(`/api/v1/teacher/assignments/${assignmentId}/code-tests`, {
          headers: sameOrigin, data: { language: 'javascript', tests: TESTS },
        });
        expect(put.status(), 'PUT code-tests kao nastavnik zadatka').toBe(200);
        expect(await put.json()).toMatchObject({ language: 'javascript', tests: TESTS });

        await teacher.page.goto(app(`/nastavnik/zadatak/${assignmentId}/testovi`));
        await expect(teacher.page.getByRole('heading', { name: 'Testovi uz zadatak', exact: true })).toBeVisible();
        await expect(teacher.page.getByLabel('Naziv testa').first()).toHaveValue(TESTS[0].title);

        // Somebody else's and an unknown assignment are the same 404, on the wire and on the page.
        for (const id of [assignmentId, randomUUID()]) {
          const read = await other.page.request.get(`/api/v1/teacher/assignments/${id}/code-tests`);
          expect(read.status(), `GET code-tests nastavnika drugog kolegija za ${id}`).toBe(404);
        }
        const foreignWrite = await other.page.request.put(`/api/v1/teacher/assignments/${assignmentId}/code-tests`, {
          headers: sameOrigin, data: { language: 'javascript', tests: [] },
        });
        expect(foreignWrite.status(), 'PUT code-tests nastavnika drugog kolegija').toBe(404);
        await other.page.goto(app(`/nastavnik/zadatak/${assignmentId}/testovi`));
        await expect(other.page.getByText('Ovaj zadatak nije dostupan.')).toBeVisible();
        await expect(other.page.getByLabel('Naziv testa')).toHaveCount(0);

        // Somebody else's submissions: the page says the assignment is not among the teacher's.
        await other.page.goto(app(`/nastavnik/zadatak/${assignmentId}/predaje`));
        await expect(other.page.getByText(/Zadatak nije pronađen među Vašim zadacima/)).toBeVisible();

        for (const width of [1250, 400]) {
          await teacher.page.setViewportSize({ width, height: 900 });
          await teacher.page.goto(app(`/nastavnik/zadatak/${assignmentId}/testovi`));
          await expect(teacher.page.getByLabel('Naziv testa').first()).toBeVisible();
          await axe(teacher.page);
        }
      } finally {
        await teacher.context.close();
        await other.context.close();
      }
    });

    test('student umeće formulu i blok koda, a nakon osvježavanja rad je na poslužitelju', async ({ browser, page }) => {
      test.setTimeout(180_000);
      await signInThroughPreloader(page, 'demo-student');
      await openWork(page, assignmentId);
      const editor = editorOf(page);
      await editor.click();
      await page.keyboard.press('Control+End');

      await chooseFromMenu(page, 'Umetni', 'Formula…');
      const formulaDialog = page.getByRole('dialog', { name: 'Formula', exact: true });
      await formulaDialog.getByLabel('Zapis (LaTeX); možete ga i sami upisati').fill(FORMULA);
      await expect(formulaDialog.getByRole('img', { name: 'Pregled formule' }).or(formulaDialog.locator('.katex'))).toBeVisible();
      await formulaDialog.getByRole('button', { name: 'Spremi', exact: true }).click();
      await expect(editor.locator('.katex').first(), 'formula u radu').toBeVisible();

      await editor.click();
      await page.keyboard.press('Control+End');
      await chooseFromMenu(page, 'Umetni', 'Blok koda…');
      const codeDialog = page.getByRole('dialog', { name: 'Blok koda', exact: true });
      await codeDialog.getByLabel('Jezik').selectOption({ label: 'JavaScript' });
      await codeDialog.getByLabel('Naslov ispisa (neobavezno)').fill(CAPTION);
      await codeDialog.getByRole('button', { name: 'Spremi', exact: true }).click();
      const block = editor.locator('pre').first();
      await expect(block, 'blok koda u radu').toBeVisible();
      await block.click();
      await page.keyboard.insertText(CODE);
      await expect(block).toContainText('function solve');

      // The server holds the work: a fresh browser context has no journal and reads it back.
      await expect(saveChipOf(page)).toHaveText(SAVED_ON_SERVER, { timeout: 30_000 });
      await page.reload();
      await expect(editor).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
      await expect(editor.locator('.katex').first(), 'formula nakon osvježavanja').toBeVisible();
      await expect(editor.locator('pre').first()).toContainText('function solve');
      const fresh = await signedInPage(browser, 'demo-student');
      try {
        await openWork(fresh.page, assignmentId);
        await expect(fresh.page.locator('.katex').first(), 'formula iz poslužitelja u svježem kontekstu').toBeVisible();
        await expect(editorOf(fresh.page).locator('pre').first()).toContainText('function solve');
      } finally {
        await fresh.context.close();
      }
    });

    test('student uvozi izmišljenu bilježnicu: HTML izlaz je odbačen, kod se ne izvršava', async ({ page }) => {
      test.setTimeout(120_000);
      await signInThroughPreloader(page, 'demo-student');
      await openWork(page, assignmentId);
      await page.getByRole('button', { name: 'Uvezi tekst iz datoteke', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Uvezi tekst iz datoteke', exact: true });
      await dialog.locator('#uvoz-datoteka').setInputFiles({
        name: 'izmisljena-biljeznica.ipynb', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(NOTEBOOK)),
      });
      await dialog.getByRole('button', { name: 'Pregledaj uvoz', exact: true }).click();
      await expect(dialog.getByText('Odbačeno izlaza (HTML, JavaScript, slike i ostalo): 1.')).toBeVisible();
      await dialog.getByRole('button', { name: 'Potvrdi uvoz', exact: true }).click();
      await expect(dialog.getByText(/^Uvezeno blokova: \d+, označeno kao uvezeno\. Odbačeno izlaza: 1\.$/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Zatvori', exact: true }).click();

      const editor = editorOf(page);
      await expect(editor).toContainText('Izmišljeni ispis');
      await expect(editor, 'tekst <script> ostaje običan tekst').toContainText('<script>alert(1)</script>');
      await expect(editor).not.toContainText('HTML izlaz se odbacuje');
      await expect(editor.locator('script')).toHaveCount(0);
      await expect(saveChipOf(page)).toHaveText(SAVED_ON_SERVER, { timeout: 30_000 });
    });

    test('student pokreće testove nad blokom koda: jedan prolazi, jedan pada', async ({ page }) => {
      test.setTimeout(120_000);
      await signInThroughPreloader(page, 'demo-student');
      await openWork(page, assignmentId);
      const editor = editorOf(page);
      const block = editor.locator('pre').filter({ hasText: 'function solve' }).first();
      await expect(block).toBeVisible();
      await block.getByRole('button', { name: 'Pokreni testove', exact: true }).click();
      const result = page.getByRole('dialog', { name: 'Rezultat testova', exact: true });
      await expect(result.getByText('Pokrenuto u vašem pregledniku; to nije provjera nastavnika i ne ulazi u ocjenu.')).toBeVisible();
      await expect(result.getByText('Prošlo 1 od 2 testova.')).toBeVisible({ timeout: 30_000 });
      await expect(result.getByRole('listitem').filter({ hasText: TESTS[0].title })).toContainText('prošao');
      const failed = result.getByRole('listitem').filter({ hasText: TESTS[1].title });
      await expect(failed).toContainText('pao');
      await expect(failed).toContainText('Očekivano');
      await expect(failed).toContainText('Dobiveno');
      await result.getByRole('button', { name: 'Zatvori', exact: true }).click();
    });

    for (const width of [1250, 400]) {
      test(`axe bez nalaza na radu studenta na ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signInThroughPreloader(page, 'demo-student');
        await openWork(page, assignmentId);
        await expect(editorOf(page).locator('.katex').first()).toBeVisible();
        await axe(page);
      });
    }

    test('student predaje rad, a nastavnik u predanoj verziji vidi formulu i kod', async ({ browser, page }) => {
      test.setTimeout(180_000);
      await signInThroughPreloader(page, 'demo-student');
      await openWork(page, assignmentId);
      await expect(saveChipOf(page)).toHaveText(SAVED_ON_SERVER, { timeout: 30_000 });
      const submissionPath = app(`/rad/${assignmentId}/predaja`);
      // As in the system tests: the toolbar covers the top bar's link at small heights, so it is opened by keyboard.
      await page.getByRole('link', { name: 'Predaja rada', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(`${webOrigin}${submissionPath}/izjava`);
      await page.getByRole('link', { name: /^(Ispuni|Uredi) izjavu$/ }).click();
      await page.getByRole('button', { name: 'Spremi izjavu' }).click();
      await expect(page.getByText('Izjava o pomoći je spremljena na poslužitelju.')).toBeVisible();
      const confirmBox = page.getByRole('checkbox', { name: 'Potvrđujem izjavu' });
      await confirmBox.click();
      await expect(confirmBox).toBeChecked();
      await page.getByRole('button', { name: 'Dalje', exact: true }).click();
      await expect(page).toHaveURL(`${webOrigin}${submissionPath}/pregled`);
      await page.getByRole('button', { name: 'Dalje', exact: true }).click();
      await expect(page).toHaveURL(`${webOrigin}${submissionPath}/slanje`);
      await page.getByRole('button', { name: 'Predaj rad', exact: true }).click();
      await page.getByRole('dialog', { name: 'Predati rad?', exact: true }).getByRole('button', { name: 'Predaj rad', exact: true }).click();
      await expect(page).toHaveURL(`${webOrigin}${submissionPath}/potvrda`, { timeout: 60_000 });

      const teacher = await signedInPage(browser, 'demo-teacher');
      try {
        await teacher.page.goto(app(`/nastavnik/zadatak/${assignmentId}/predaje`));
        await expect(teacher.page.getByRole('heading', { name: 'Predaje zadatka', exact: true })).toBeVisible();
        await teacher.page.getByRole('button', { name: 'Otvori predanu verziju' }).or(teacher.page.getByRole('link', { name: 'Otvori predanu verziju' })).first().click();
        const version = teacher.page.getByRole('dialog', { name: 'Predana verzija' }).or(teacher.page.getByRole('region', { name: 'Predana verzija' }));
        await expect(version.locator('.katex').first(), 'formula u predanoj verziji').toBeVisible({ timeout: 30_000 });
        await expect(version).toContainText('function solve');
        await expect(version, 'kod se kod nastavnika ne izvršava').toContainText('Kod se ovdje ne izvršava.');
        await expect(version).not.toContainText('Pokreni testove');
        for (const width of [1250, 400]) {
          await teacher.page.setViewportSize({ width, height: 900 });
          await axe(teacher.page);
        }
      } finally {
        await teacher.context.close();
      }
    });
  });
}
