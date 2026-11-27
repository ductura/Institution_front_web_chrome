import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { app, webOrigin } from './stog';
import { describePageOnFailure, signInDemoStudent, signInThroughPreloader } from './student';

describePageOnFailure();

// PM2-R10 (F4, A4): the whole K-4 flow in one test, on invented data only: the teacher creates a
// course, an assignment and an enrolment code, a student enrols with that code and writes, and
// the student and the teacher then read the very same process summary. It does not depend on the
// seed work of INT-02..INT-04, so it can run alone: `pnpm test:sistem k4-puni-tok`.

function post(page: Page, path: string, data: object) {
  return page.evaluate(async ({ path, data }) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { path, data });
}

test('PM2-R10: nastavnik stvara zadatak i kod, student se upisuje i piše, oba vide isti sažetak procesa', async ({ browser }) => {
  const runId = randomUUID();
  const courseName = `Izmišljeni kolegij K-4 ${runId.slice(0, 8)}`;
  const assignmentTitle = `Izmišljeni zadatak K-4 ${runId.slice(0, 8)}`;
  const paragraph = `U izmišljenom vrtu mjerimo vlagu tla (${runId}).`;
  const teacherContext = await browser.newContext({ baseURL: webOrigin });
  const studentContext = await browser.newContext({ baseURL: webOrigin });

  try {
    const teacher = await teacherContext.newPage();
    const student = await studentContext.newPage();

    const { assignmentId, code } = await test.step('Nastavnik stvara kolegij, zadatak i kod za upis', async () => {
      await signInThroughPreloader(teacher, 'demo-teacher');
      await expect(teacher).toHaveURL(`${webOrigin}${app('/nastavnik')}`);

      const course = await post(teacher, '/api/v1/institution/courses', {
        name: courseName, academicYear: '2026/2027', aiPolicy: 'partially_allowed',
      });
      expect(course.status, 'Izrada kolegija').toBe(200);
      const courseId = course.body.id as string;

      const now = Date.now();
      const assignment = await post(teacher, `/api/v1/institution/courses/${courseId}/assignments`, {
        requestKey: randomUUID(), title: assignmentTitle, instructions: 'Izmišljeni opis zadatka.',
        workType: 'short_paper',
        opensAt: new Date(now - 3_600_000).toISOString(),
        dueAt: new Date(now + 30 * 86_400_000).toISOString(),
        aiPolicy: 'prohibited', aiPurposes: [], evidenceProfile: 'basic',
        importAllowed: false, wordMin: null, wordMax: null,
      });
      expect(assignment.status, 'Izrada zadatka').toBe(201);

      const issued = await post(teacher, `/api/v1/institution/courses/${courseId}/enrollment-code`, {
        validUntil: new Date(now + 7 * 86_400_000).toISOString(),
      });
      expect(issued.status, 'Izdavanje koda za upis').toBe(200);
      expect(issued.body.code).toMatch(/^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/);

      await teacher.reload();
      await expect(teacher.getByRole('heading', { name: courseName, exact: true })).toBeVisible();
      return { assignmentId: assignment.body.id as string, code: issued.body.code as string };
    });

    await test.step('Student se upisuje kodom na stranici Upis i otvara zadatak', async () => {
      await signInDemoStudent(student, 'demo-student-2');
      await student.goto(app('/upis'));
      await student.getByLabel('Kod kolegija').fill(code);
      await student.getByRole('button', { name: 'Upiši', exact: true }).click();
      // The enrolment leads to the assignment's notice (/zadatak/<id>); the editor opens only after
      // the student acknowledges what is recorded.
      await expect(student).toHaveURL(`${webOrigin}${app(`/zadatak/${assignmentId}`)}`, { timeout: 30_000 });
      await student.getByRole('checkbox', { name: /Pročitao\/la sam obavijest/ }).check();
      await student.getByRole('button', { name: 'Potvrdi i otvori editor', exact: true }).click();
      // After the acknowledgment the app goes on to the editor by itself; the "Otvori editor" link
      // is only there when it stays on the notice, so it is used only if it is shown.
      await student.getByRole('link', { name: 'Otvori editor', exact: true }).click({ timeout: 3_000 }).catch(() => undefined);
      await expect(student).toHaveURL(`${webOrigin}${app(`/rad/${assignmentId}`)}`, { timeout: 30_000 });
    });

    const documentId = await test.step('Student piše odlomak, a poslužitelj potvrđuje snimku', async () => {
      // A new assignment has no work yet: "Započni rad" on its page makes it (one work per student
      // and assignment) and only the server's answer opens the editor.
      await student.getByRole('button', { name: /^Započni rad/ }).click();
      const editor = student.getByRole('textbox', { name: 'Tekst rada', exact: true });
      await expect(editor).toBeEditable({ timeout: 30_000 });
      await editor.click();
      const [commit] = await Promise.all([
        student.waitForResponse((response) => {
          if (response.url() !== `${webOrigin}/api/v1/evidence/commit` || response.request().method() !== 'POST'
            || [202, 426].includes(response.status())) return false;
          const document = response.request().postDataJSON()?.document;
          return typeof document === 'string' && Buffer.from(document, 'base64').toString('utf8').includes(paragraph);
        }, { timeout: 30_000 }),
        student.keyboard.insertText(paragraph),
      ]);
      expect(commit.status(), 'Spremanje odlomka').toBe(200);
      await expect(student.locator('footer[aria-label="Stanje rada"]').locator('[data-tone]').first())
        .toHaveText('Spremljeno na poslužitelju', { timeout: 30_000 });
      return commit.request().postDataJSON().documentId as string;
    });

    await test.step('Student i nastavnik čitaju isti sažetak procesa', async () => {
      const own = await post(student, '/api/v1/process-summary', { documentId });
      expect(own.status, 'Sažetak za studenta').toBe(200);
      expect(own.body).toMatchObject({ summaryFormat: 'ductus-process-summary-v1' });
      const teachers = await post(teacher, '/api/v1/process-summary', { documentId });
      expect(teachers.status, 'Sažetak za nastavnika kolegija').toBe(200);
      expect(teachers.body).toEqual(own.body);
    });
  } finally {
    await Promise.all([teacherContext.close(), studentContext.close()]);
  }
});
