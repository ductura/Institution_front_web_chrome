import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { messagesHr as t } from '../../src/lib/i18n/messages.hr';
import { oidcOrigin, webOrigin } from './stog';
import { signInDemoStudent } from './student';

const adminCourses = '/ustanova/kolegiji';
const teacherCourses = '/nastavnik/kolegiji';
const createCourseApi = '/api/v1/institution/admin/courses';
const settingsApi = '/api/v1/settings/values';
const profileKey = 'lekta.profile';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;

type StoredProfile = { key: string; value: string | null; bound: { locked: true } | null };

async function signIn(
  page: Page,
  account: 'sim:nastavnik:demo-admin@demo.ductus.test' | 'demo-teacher-2',
  path: string,
  role: 'institution_admin' | 'teacher',
) {
  await page.goto(`/prijava?returnTo=${encodeURIComponent(path)}`);
  await page.getByRole('link', { name: 'Prijava sustavom AAI@EduHr', exact: true }).click();
  await expect(page).toHaveURL((url) => url.origin === oidcOrigin);
  await page.locator(`button[name="account"][value="${account}"]`).click();
  await expect(page).toHaveURL(`${webOrigin}${path}`);

  const me = await page.request.get('/api/v1/me');
  await expect(me).toBeOK();
  expect(await me.json()).toMatchObject({
    institution: { slug: 'demo-fakultet' },
    roles: expect.arrayContaining([role]),
  });
}

async function readProfile(page: Page) {
  const response = await page.request.get(`${settingsApi}?level=institution`);
  await expect(response).toBeOK();
  const { values } = await response.json() as { values: StoredProfile[] };
  return values.find(({ key }) => key === profileKey);
}

async function writeProfile(page: Page, value: string | null, locked: boolean) {
  const result = await page.evaluate(async ({ path, body }) => {
    const response = await fetch(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, {
    path: settingsApi,
    body: { level: 'institution', course: null, key: profileKey, value, locked, min: null, max: null },
  });
  expect(result.status, `Spremanje profila Lekta: ${JSON.stringify(result.body)}`).toBe(200);
  expect(result.body).toMatchObject({ key: profileKey, value, bound: locked ? { locked: true } : null });
  return result.body.changed;
}

test('INT-05: administrator izrađuje kolegij, postavlja profil provjera, a nositelj vidi kolegij', async ({ page, browser }) => {
  const courseName = `Izmišljeni seminar o vrtovima na Mjesecu (${randomUUID()})`;
  const student = await browser.newPage({ baseURL: webOrigin });
  try {
    const { courseId: demoCourseId, assignmentId } = await test.step('Pronađi demo kolegij i zadatak iz redovnog seeda', async () => {
      await signInDemoStudent(student);
      const response = await student.request.get('/api/v1/student/assignments');
      await expect(response).toBeOK();
      const { courses } = await response.json() as {
        courses: { id: string; name: string; assignments: { id: string; title: string }[] }[];
      };
      const course = courses.find(({ name }) => name === 'Izmišljeni seminar iz ekologije grada');
      const assignment = course?.assignments.find(({ title }) => title === 'Seminarski rad: kućno kompostiranje');
      if (!course || !assignment) throw new Error('U redovnom seedu nedostaje kolegij ili zadatak o kompostiranju.');
      return { courseId: course.id, assignmentId: assignment.id };
    });

    const { courseId, academicYear, aiPolicy } = await test.step('Izradi novi kolegij i dodijeli demo-teacher-2 kao nositelja', async () => {
      await signIn(page, 'sim:nastavnik:demo-admin@demo.ductus.test', adminCourses, 'institution_admin');
      const response = await page.request.get(`/api/v1/institution/courses/${demoCourseId}/groups`);
      await expect(response).toBeOK();
      const { groups } = await response.json() as {
        groups: { name: string; teachers: { id: string; givenName: string; familyName: string }[] }[];
      };
      const holder = groups.find(({ name }) => name === 'Grupa B')?.teachers.find(
        ({ givenName, familyName }) => givenName === 'Maja' && familyName === 'Džombić',
      );
      if (!holder) throw new Error('U redovnom seedu nedostaje demo-teacher-2 u Grupi B.');
      expect(holder.id).toMatch(uuid);

      const form = t.institutionCourses.newCourse;
      await expect(page.getByRole('heading', { name: form.title, exact: true })).toBeVisible();
      await page.getByLabel(form.name, { exact: true }).fill(courseName);
      const academicYear = await page.getByLabel(form.academicYear, { exact: true }).inputValue();
      expect(academicYear).toMatch(/^\d{4}\/\d{4}$/);
      const aiPolicy = 'partially_allowed';
      await page.getByLabel(form.aiPolicy, { exact: true }).selectOption(aiPolicy);
      await page.getByLabel(form.holder, { exact: true }).fill(holder.id);

      const [created] = await Promise.all([
        page.waitForResponse((response) => response.url() === `${webOrigin}${createCourseApi}`
          && response.request().method() === 'POST'),
        page.getByRole('button', { name: form.submit, exact: true }).click(),
      ]);
      expect(created.request().postDataJSON()).toEqual({
        name: courseName, academicYear, aiPolicy, holderId: holder.id, groups: [],
      });
      const body = await created.json();
      expect(created.status(), `Izrada kolegija: ${JSON.stringify(body)}`).toBe(200);
      expect(body).toMatchObject({ id: expect.stringMatching(uuid), groups: [] });
      await expect(page.getByRole('status')).toHaveText(form.created.replace('{name}', courseName));
      return { courseId: body.id as string, academicYear, aiPolicy };
    });

    const previous = await readProfile(page);
    const profile = previous?.value === 'fpzg-opci-akademski-rad' ? 'fpzg-politologija-diplomski' : 'fpzg-opci-akademski-rad';
    const locked = previous?.bound?.locked ?? false;
    try {
      await test.step('Postavi profil provjera ustanove i provjeri ga na zadatku studenta', async () => {
        expect(await writeProfile(page, profile, locked)).toBe(true);
        expect(await readProfile(page)).toMatchObject({ key: profileKey, value: profile });
        const config = await student.request.get(`/api/v1/student/assignments/${assignmentId}/text-check-config`);
        await expect(config).toBeOK();
        expect(await config.json()).toMatchObject({
          lektaProfileId: profile,
          enabledCheckIds: expect.arrayContaining(['colloq', 'absolute', 'first']),
        });
      });

      await test.step('U zasebnoj sesiji nositelj vidi isti novi kolegij', async () => {
        const teacher = await browser.newPage({ baseURL: webOrigin });
        try {
          await signIn(teacher, 'demo-teacher-2', teacherCourses, 'teacher');
          await expect(teacher.getByRole('heading', { name: courseName, exact: true })).toBeVisible();
          const response = await teacher.request.get('/api/v1/teacher/courses');
          await expect(response).toBeOK();
          expect(await response.json()).toMatchObject({
            courses: expect.arrayContaining([expect.objectContaining({ id: courseId, name: courseName, academicYear, aiPolicy })]),
          });
        } finally {
          await teacher.close();
        }
      });
    } finally {
      await test.step('Vrati prethodni profil provjera ustanove', async () => {
        await writeProfile(page, previous?.value ?? null, locked);
      });
    }
  } finally {
    await student.close();
  }
});
