import { randomUUID } from 'node:crypto';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { academicYears } from '../../src/app/ustanova/kolegiji/new-course';
import { messagesHr } from '../../src/lib/i18n/messages.hr';
import { oidcOrigin, webOrigin } from './stog';
import { signInDemoStudent } from './student';

const t = messagesHr.institutionCourses.newCourse;

async function signIn(page: Page, account: string, returnTo: string, role: 'institution_admin' | 'teacher') {
  await page.goto(`/prijava?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole('link', { name: 'Prijava sustavom AAI@EduHr', exact: true }).click();
  await expect(page).toHaveURL((url) => url.origin === oidcOrigin);
  await page.locator(`button[name="account"][value="${account}"]`).click();
  await expect(page).toHaveURL(`${webOrigin}${returnTo}`);
  const me = await page.request.get('/api/v1/me');
  await expect(me).toBeOK();
  expect(await me.json()).toMatchObject({ institution: { slug: 'demo-fakultet' }, roles: expect.arrayContaining([role]) });
}

function postFromBrowser(page: Page, path: string, data: object) {
  return page.evaluate(async ({ path, data }) => {
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { path, data });
}

// Nositelj kolegija izrađenog u ovom testu je suradnik seedanog kolegija (demo-teacher-2).
// Njegov identifikator čita se kao student kolegija, jer ga /api/v1/me ne vraća.
async function collaboratorId(page: Page) {
  await signInDemoStudent(page);
  const response = await page.request.get('/api/v1/student/assignments');
  await expect(response).toBeOK();
  const { courses } = await response.json() as { courses: { teachers?: { id: string; role: string }[] }[] };
  const found = courses.flatMap((course) => course.teachers ?? []).find((teacher) => teacher.role === 'collaborator');
  expect(found, 'Seed treba imati suradnika kolegija (demo-teacher-2).').toBeDefined();
  return found!.id;
}

async function session(browser: Browser) {
  const context = await browser.newContext({ baseURL: webOrigin });
  return { context, page: await context.newPage() };
}

test('INT-05: administrator izrađuje kolegij, nositelj ga vidi i postavlja konfiguraciju provjera', async ({ page, browser }) => {
  const holderId = await collaboratorId(page);
  const courseName = `Izmišljeni kolegij INT-05 ${randomUUID().slice(0, 8)}`;
  const assignmentTitle = `Zadatak INT-05 ${randomUUID().slice(0, 8)}`;
  const admin = await session(browser);
  const holder = await session(browser);
  const teacher = await session(browser);

  try {
    await test.step('Administrator ustanove izrađuje kolegij s nositeljem', async () => {
      await signIn(admin.page, 'demo-admin', '/ustanova/kolegiji', 'institution_admin');
      await admin.page.getByLabel(t.name).fill(courseName);
      await admin.page.getByLabel(t.aiPolicy).selectOption('partially_allowed');
      await admin.page.getByLabel(t.holder).fill(holderId);
      const [created] = await Promise.all([
        admin.page.waitForResponse((response) => response.url() === `${webOrigin}/api/v1/institution/admin/courses`
          && response.request().method() === 'POST'),
        admin.page.getByRole('button', { name: t.submit, exact: true }).click(),
      ]);
      expect(created.status()).toBe(200);
      await expect(admin.page.getByRole('status').filter({ hasText: courseName })).toBeVisible();
      // Isti naziv u istoj godini je sukob.
      const again = await postFromBrowser(admin.page, '/api/v1/institution/admin/courses', {
        name: courseName, academicYear: academicYears(new Date())[0],
        aiPolicy: 'partially_allowed', holderId, groups: [],
      });
      expect(again.status).toBe(409);
    });

    const courseId = await test.step('Nositelj vidi novi kolegij među svojima', async () => {
      await signIn(holder.page, 'demo-teacher-2', '/nastavnik', 'teacher');
      await expect(holder.page.getByRole('heading', { name: courseName, exact: true })).toBeVisible();
      const link = holder.page.getByRole('link', { name: new RegExp(courseName) }).first();
      const href = await link.getAttribute('href').catch(() => null);
      return href?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
    });

    await test.step('Nositelj postavlja konfiguraciju provjera zadatka i vidi ga na popisu', async () => {
      const id = courseId ?? (await (async () => {
        const listed = await holder.page.request.get('/api/v1/teacher/courses');
        const body = await listed.json() as { courses: { id: string; name: string }[] };
        return body.courses.find((course) => course.name === courseName)?.id;
      })());
      expect(id, 'Identifikator novog kolegija.').toBeDefined();
      const now = Date.now();
      const created = await postFromBrowser(holder.page, `/api/v1/institution/courses/${id}/assignments`, {
        requestKey: randomUUID(), title: assignmentTitle, instructions: 'Izmišljene upute za provjeru toka INT-05.',
        workType: 'seminar_paper', opensAt: new Date(now).toISOString(), dueAt: new Date(now + 30 * 864e5).toISOString(),
        aiPolicy: 'partially_allowed', aiPurposes: ['proofreading'], evidenceProfile: 'basic', importAllowed: false,
        wordMin: 300, wordMax: 1200,
      });
      expect(created.status).toBe(201);
      await holder.page.goto('/nastavnik');
      await expect(holder.page.getByText(assignmentTitle, { exact: true })).toBeVisible();
    });

    await test.step('Nastavnik bez administratorske uloge ne može izraditi kolegij', async () => {
      await signIn(teacher.page, 'demo-teacher', '/nastavnik', 'teacher');
      const response = await teacher.page.goto('/ustanova/kolegiji');
      expect(response?.status()).toBe(404);
      const denied = await postFromBrowser(teacher.page, '/api/v1/institution/admin/courses', {
        name: `${courseName} 2`, academicYear: '2026/2027', aiPolicy: 'prohibited', holderId, groups: [],
      });
      expect(denied.status).toBe(403);
      await teacher.page.goto('/nastavnik');
      await expect(teacher.page.getByText(courseName, { exact: true })).toHaveCount(0);
    });
  } finally {
    await Promise.all([admin.context.close(), holder.context.close(), teacher.context.close()]);
  }
});
