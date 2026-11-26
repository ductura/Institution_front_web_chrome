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
// flow (create slides, sync, submit, export) needs WEB-V13-DNEVNIK-SINKRONIZACIJA and WEB-V13-PREDAJA, which are not
// on the base of this task, so it is not here (see the PR, "Otvoreno"); until then the work comes from the seed.
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';
import { app, webOrigin } from './sistem/stog';
import { signInThroughPreloader } from './sistem/student';

async function signedInPage(browser, account) {
  const context = await browser.newContext({ baseURL: webOrigin });
  const page = await context.newPage();
  await signInThroughPreloader(page, account);
  return { context, page };
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
}
