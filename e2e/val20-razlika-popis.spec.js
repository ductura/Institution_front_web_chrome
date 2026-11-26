// WEB-V20-E2E, step "popis literature za stil ustanove" (V20-11, V20-14). StudentBibliographyHost is mounted in the
// "Literatura" part of the sources card (packages/app/src/host/student/work.tsx, V18-22-R02), so this flow runs.
// Like val20-razlika.spec.js it registers its tests only on the stack (DUCTURA_STOG=1):
//   DUCTURA_STOG=1 pnpm exec playwright test --project=chromium e2e/val20-razlika-popis.spec.js
// The style is not chosen by the student: page.route intercepts student.text-check-config.get and answers
// citationStyle "fpzg", then "ieee" (made-up data, no fake institution).
// ASSUMPTION: the work holds at least one cited source with its fields filled in (the seed work has none). NOT YET
// VERIFIED ON THE STACK: the set-up that inserts two made-up sources and cites them is still to be added by a run on it.
import { expect, test } from '@playwright/test';

import { axe } from './support/axe.js';
import { app, webOrigin } from './sistem/stog.ts';
import { dismissGuide, signInDemoStudent } from './sistem/student.ts';

const STYLE_SUMMARY = 'Popis literature u stilu ustanove';

async function answerStyle(page, citationStyle) {
  await page.route('**/api/v1/student/assignments/*/text-check-config', (route) => route.fulfill({
    json: { enabledCheckIds: [], lektaProfileId: null, citationStyle },
  }));
}

async function openList(page, assignmentId) {
  await page.goto(app(`/rad/${assignmentId}`));
  await dismissGuide(page);
  await page.getByText('Literatura', { exact: true }).click();
  await page.getByText(STYLE_SUMMARY, { exact: true }).click();
}

if (process.env.DUCTURA_STOG === '1') {
  test.use({ baseURL: webOrigin });

  for (const [style, shown] of [['fpzg', 'Stil: FPZG (postavka ustanove)'], ['ieee', 'Stil: IEEE (postavka ustanove)']]) {
    test(`popis literature slijedi stil ustanove ${style}`, async ({ page }) => {
      await signInDemoStudent(page);
      const response = await page.request.get('/api/v1/student/assignments');
      const { courses } = await response.json();
      const id = courses.flatMap((c) => c.assignments).find((a) => a.title === 'Seminarski rad: kućno kompostiranje').id;
      await answerStyle(page, style);
      await openList(page, id);
      await expect(page.getByText(shown, { exact: true })).toBeVisible();
      // numeric styles number by first citation ("[1]"), author-date styles do not
      const entries = page.getByRole('list').filter({ has: page.getByText(/\S/) }).locator('ol > li');
      if (style === 'ieee') await expect(entries.first()).toHaveText(/^\[1\]/);
      else await expect(entries.first()).not.toHaveText(/^\[1\]/);
      await axe(page);
    });
  }

  test('pad čitanja stila ne mijenja popis: ostaje FPZG s napomenom', async ({ page }) => {
    await signInDemoStudent(page);
    const { courses } = await (await page.request.get('/api/v1/student/assignments')).json();
    const id = courses.flatMap((c) => c.assignments).find((a) => a.title === 'Seminarski rad: kućno kompostiranje').id;
    await page.route('**/api/v1/student/assignments/*/text-check-config', (route) => route.fulfill({ status: 503, json: { code: 'unavailable' } }));
    await openList(page, id);
    await expect(page.getByRole('status').filter({ hasText: 'Prikazuje se zadani stil FPZG' })).toBeVisible();
  });
}
