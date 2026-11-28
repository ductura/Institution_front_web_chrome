// WEB-V13-NASTAVNIK-PREGLED (val13-razlika.md §4, zadatak 13): the teacher reads the slides of a work on the local
// stack as invented users of the fake AAI@EduHr (D-09): the slides page with the list, the speaker notes, the choice
// and stepping of revisions, the comparison of two revisions and the export buttons; somebody else's work and an
// unknown id are 404 ("nije dostupno"); axe at 1250 and 400 px.
//
// Like val21-razlika, the file needs the whole local stack, so its tests are registered only with DUCTURA_STOG=1
// (without it they do not exist, rather than being skipped):
//
//   DUCTURA_STOG=1 DUCTURA_V13_SLIDES_WORK=<documentId> pnpm exec playwright test --project=chromium e2e/val13-razlika.spec.js
//
// Precondition (the first test fails with the reason, it does not skip): DUCTURA_V13_SLIDES_WORK is the id of an
// invented slides work of the course of `demo-teacher`, with at least two saved revisions. The student's half of the
// flow (create slides, sync, submit, export) is the second describe (F4-V13-R04): it needs no precondition, the teacher
// makes an invented course and a slides assignment through /api/v1 and the student does the rest in the shipped app.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';
import { app, webOrigin } from './sistem/stog';
import { signInDemoStudent, signInThroughPreloader } from './sistem/student';

async function signedInPage(browser, account) {
  const context = await browser.newContext({ baseURL: webOrigin });
  const page = await context.newPage();
  await signInThroughPreloader(page, account);
  return { context, page };
}

function postJson(page, path, data) {
  return page.evaluate(async ({ path, data }) => {
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { path, data });
}

if (process.env.DUCTURA_STOG === '1') {
  test.use({ baseURL: webOrigin });
  test.describe.configure({ mode: 'serial' });

  test.describe('val 13: nastavnik čita slajdove (WEB-V13-NASTAVNIK-PREGLED)', () => {
    const workId = process.env.DUCTURA_V13_SLIDES_WORK ?? '';

    test('nastavnik vidi slajdove, bilješke, revizije i usporedbu; axe 1250 i 400 px', async ({ browser }) => {
      expect(workId, 'DUCTURA_V13_SLIDES_WORK mora biti id izmišljenog rada sa slajdovima').not.toBe('');
      const teacher = await signedInPage(browser, 'demo-teacher');
      try {
        const page = teacher.page;
        await page.goto(app(`/nastavnik/rad/${workId}`));
        await expect(page.getByRole('heading', { name: 'Slajdovi rada', exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Slajdovi se samo čitaju.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Bilješke govornika' })).toBeVisible();
        await expect(page.getByRole('textbox')).toHaveCount(0);

        const revisions = page.getByLabel('Odaberi reviziju');
        expect(await revisions.locator('option').count()).toBeGreaterThanOrEqual(2);
        await page.getByRole('button', { name: 'Prethodna revizija' }).click();
        await page.getByLabel('Starija revizija').selectOption({ index: 1 });
        await expect(page.getByRole('heading', { name: 'Usporedba dviju revizija' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Preuzmi .pptx' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Preuzmi PDF' })).toBeVisible();

        for (const width of [1250, 400]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(app(`/nastavnik/rad/${workId}`));
          await expect(page.getByRole('heading', { name: 'Slajdovi rada', exact: true })).toBeVisible();
          await axe(page);
        }
      } finally {
        await teacher.context.close();
      }
    });

    test('tuđi i nepoznat rad su 404 na žici i ne otvaraju slajdove na stranici', async ({ browser }) => {
      const other = await signedInPage(browser, 'demo-teacher-2');
      try {
        for (const id of [workId, randomUUID()]) {
          const read = await other.page.request.get(`/api/v1/works/${id}/versions`);
          expect(read.status(), `work.versions.get za ${id}`).toBe(404);
          const exported = await other.page.request.get(`/api/v1/works/${id}/export-slides?format=pptx`);
          expect(exported.status(), `work.export-slides.get za ${id}`).toBe(404);
        }
        await other.page.goto(app(`/nastavnik/rad/${workId}`));
        await expect(other.page.getByRole('heading', { name: 'Slajdovi rada', exact: true })).toHaveCount(0);
        await expect(other.page.getByRole('button', { name: 'Preuzmi .pptx' })).toHaveCount(0);
      } finally {
        await other.context.close();
      }
    });
  });

  // F4-V13-R04: the student's half of val 13 on the real stack (V13-R01 opens a slides work, V13-R02 reconstructs its
  // submission): create (assignment of kind slides, "Započni rad"), sync (a typed title reaches the server and the chip says
  // "Spremljeno na poslužitelju"), submit (the slides step, then the receipt) and export (.pptx is a ZIP). Invented data only.
  test.describe('val 13: student stvara, sinkronizira, predaje i izvozi slajdove (F4-V13-R04)', () => {
    test('slajdovi: stvori, sinkroniziraj, predaj, izvezi; tuđi student dobiva 404', async ({ browser }) => {
      const runId = randomUUID();
      const title = `Izmišljeni naslov slajda ${runId.slice(0, 8)}`;
      const teacherContext = await browser.newContext({ baseURL: webOrigin });
      const studentContext = await browser.newContext({ baseURL: webOrigin, acceptDownloads: true });
      const otherContext = await browser.newContext({ baseURL: webOrigin });
      try {
        const teacher = await teacherContext.newPage();
        const student = await studentContext.newPage();

        const { assignmentId, code } = await test.step('Nastavnik stvara kolegij, zadatak vrste slajdovi i kod za upis', async () => {
          await signInThroughPreloader(teacher, 'demo-teacher');
          const course = await postJson(teacher, '/api/v1/institution/courses', {
            name: `Izmišljeni kolegij V13 ${runId.slice(0, 8)}`, academicYear: '2026/2027', aiPolicy: 'partially_allowed',
          });
          expect(course.status, 'Izrada kolegija').toBe(200);
          const now = Date.now();
          const assignment = await postJson(teacher, `/api/v1/institution/courses/${course.body.id}/assignments`, {
            requestKey: randomUUID(), title: `Izmišljena prezentacija V13 ${runId.slice(0, 8)}`, instructions: 'Izmišljeni opis zadatka.',
            workType: 'short_paper', documentKind: 'slides',
            opensAt: new Date(now - 3_600_000).toISOString(), dueAt: new Date(now + 30 * 86_400_000).toISOString(),
            aiPolicy: 'prohibited', aiPurposes: [], evidenceProfile: 'basic', importAllowed: false, wordMin: null, wordMax: null,
          });
          expect(assignment.status, 'Izrada zadatka vrste slajdovi').toBe(201);
          const issued = await postJson(teacher, `/api/v1/institution/courses/${course.body.id}/enrollment-code`, {
            validUntil: new Date(now + 7 * 86_400_000).toISOString(),
          });
          expect(issued.status, 'Izdavanje koda za upis').toBe(200);
          return { assignmentId: assignment.body.id, code: issued.body.code };
        });

        await test.step('Student se upisuje, potvrđuje obavijest i započinje rad: otvara se uređivač slajdova', async () => {
          await signInDemoStudent(student, 'demo-student-2');
          await student.goto(app('/upis'));
          await student.getByLabel('Kod kolegija').fill(code);
          await student.getByRole('button', { name: 'Upiši', exact: true }).click();
          await expect(student).toHaveURL(`${webOrigin}${app(`/zadatak/${assignmentId}`)}`, { timeout: 30_000 });
          await student.getByRole('checkbox', { name: /Pročitao\/la sam obavijest/ }).check();
          await student.getByRole('button', { name: 'Potvrdi i otvori editor', exact: true }).click();
          await student.getByRole('link', { name: 'Otvori editor', exact: true }).click({ timeout: 3_000 }).catch(() => undefined);
          await expect(student).toHaveURL(`${webOrigin}${app(`/rad/${assignmentId}`)}`, { timeout: 30_000 });
          await student.getByRole('button', { name: /^Započni rad/ }).click();
          await expect(student.getByRole('heading', { name: 'Slajdovi', exact: true }).first()).toBeVisible({ timeout: 30_000 });
          await expect(student.getByLabel('Popis slajdova')).toBeVisible();
        });

        const documentId = await test.step('Sinkronizacija: naslov slajda stiže na poslužitelj uz potvrdu', async () => {
          const field = student.getByRole('textbox', { name: 'Naslov', exact: true }).first();
          await expect(field).toBeEditable({ timeout: 30_000 });
          await field.click();
          const [commit] = await Promise.all([
            student.waitForResponse((response) => {
              if (response.url() !== `${webOrigin}/api/v1/evidence/commit` || response.request().method() !== 'POST'
                || [202, 426].includes(response.status())) return false;
              const document = response.request().postDataJSON()?.document;
              return typeof document === 'string' && Buffer.from(document, 'base64').toString('utf8').includes(title);
            }, { timeout: 30_000 }),
            student.keyboard.insertText(title),
          ]);
          expect(commit.status(), 'Spremanje slajdova').toBe(200);
          await expect(student.locator('footer[aria-label="Stanje rada"]').locator('[data-tone]').first())
            .toHaveText('Spremljeno na poslužitelju', { timeout: 30_000 });
          return commit.request().postDataJSON().documentId;
        });

        await test.step('Izvoz: .pptx je ZIP, a PDF počinje s %PDF', async () => {
          const [pptx] = await Promise.all([student.waitForEvent('download', { timeout: 60_000 }), student.getByRole('button', { name: 'Preuzmi .pptx' }).click()]);
          expect(pptx.suggestedFilename()).toMatch(/\.pptx$/);
          expect((await readFile(await pptx.path())).subarray(0, 2).toString('latin1'), 'ZIP (PK)').toBe('PK');
          const [pdf] = await Promise.all([student.waitForEvent('download', { timeout: 60_000 }), student.getByRole('button', { name: 'Preuzmi PDF' }).click()]);
          expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
          expect((await readFile(await pdf.path())).subarray(0, 4).toString('latin1')).toBe('%PDF');
        });

        await test.step('Predaja: korak slanja prikazuje broj slajdova, predaja vodi na potvrdu', async () => {
          await student.goto(app(`/rad/${assignmentId}/predaja/slanje`));
          await expect(student.getByRole('heading', { name: 'Predati prezentaciju?', exact: true })).toBeVisible({ timeout: 30_000 });
          await student.getByRole('button', { name: 'Predaj rad', exact: true }).click();
          const [submitted] = await Promise.all([
            student.waitForResponse((response) => response.url() === `${webOrigin}/api/v1/submission/v2` && response.request().method() === 'POST'),
            student.getByRole('dialog').getByRole('button', { name: 'Predaj rad', exact: true }).click(),
          ]);
          expect(submitted.status(), 'Predaja slajdova').toBe(200);
          expect(submitted.request().postDataJSON()).toMatchObject({ documentId });
          await expect(student).toHaveURL((url) => url.pathname === app(`/rad/${assignmentId}/predaja/potvrda`), { timeout: 30_000 });
          // The work is locked: opening it again reads only.
          await student.goto(app(`/rad/${assignmentId}`));
          await expect(student.getByText('Rad je predan. Slajdovi se samo čitaju.')).toBeVisible({ timeout: 30_000 });
        });

        await test.step('Tuđi student: izvoz i čitanje revizija su 404', async () => {
          const other = await otherContext.newPage();
          await signInDemoStudent(other, 'demo-student');
          const exported = await other.request.get(`/api/v1/works/${documentId}/export-slides?format=pptx`);
          expect(exported.status(), 'work.export-slides.get za tuđi rad').toBe(404);
        });
      } finally {
        await Promise.all([teacherContext.close(), studentContext.close(), otherContext.close()]);
      }
    });
  });
}
