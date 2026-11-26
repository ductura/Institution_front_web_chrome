// WEB-V22-E2E (val22-razlika.md §5, zadatak 11), the part without grades (F4-V18-22-R07): the trial ISVU import and the
// entry from Studomat clicked on the local stack as invented users of the fake AAI@EduHr (D-09). The administrator
// chooses a course of Ductura and a course of the trial source, sees the preview (nobody is enrolled by it), confirms in
// the dialog, and a second preview offers nobody new, so nobody is enrolled twice. `/ulaz/studomat?kolegij=<uuid>` without
// a session leads to the sign-in of the fake AAI@EduHr and then to the enrolment of that course; the link takes nothing
// else and never leaves the app. Somebody else's and an unknown course are the same 404 (on the wire and as the page's
// "nije dostupno" text); a teacher gets 403 and a student is sent home from the administrator's screen. axe at 1250
// and 400 px. The export of grades (the teacher's screen) is not part of this file: its route is not built yet (see the PR,
// "Otvoreno"). No test.fixme and no skip.
//
// Like val21-razlika and nastavnik-val5, the file needs the whole local stack, so its tests are registered only with
// DUCTURA_STOG=1 (without it they do not exist, rather than being skipped). The stack is the one of
// e2e/sistem/README.md: Institution_server (`pnpm lokalno --izvor=http://localhost:8000`), `pnpm build && pnpm start`
// of this repo and the Preloader's edge on :8000 (STOG_EDGE_PORT for another port):
//
//   DUCTURA_STOG=1 pnpm exec playwright test --project=chromium e2e/val22-razlika.spec.js
//
// The confirmation enrols the invented students of the trial source, so a second run on the same seed finds nobody new;
// the first test handles both runs (it says which one it was). Only invented names; the texts are those of
// packages/app (host/admin/isvu, host/public/studomat-entry).
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';
import { app, appBase, oidcOrigin, webOrigin } from './sistem/stog';
import { signInThroughPreloader } from './sistem/student';

const ADMIN = 'sim:nastavnik:demo-admin@demo.ductus.test';
const IMPORT_PAGE = app('/ustanova/isvu');
const IMPORT_TITLE = 'Povezivanje s ISVU-om (probni izvor)';
const sameOrigin = { origin: webOrigin };

/** Signs in as an account of the fake AAI@EduHr that has a button on its page. */
async function signedInPage(browser, account) {
  const context = await browser.newContext({ baseURL: webOrigin });
  const page = await context.newPage();
  await signInThroughPreloader(page, account);
  return { context, page };
}

/** The value of the first real option of a select (the first one is the placeholder "Odaberite…"). */
async function firstChoice(select) {
  const values = await select.locator('option').evaluateAll((options) => options.map((o) => o.value).filter((v) => v !== ''));
  expect(values.length, 'select nudi barem jedan izbor').toBeGreaterThan(0);
  return values[0];
}

async function choosePair(page) {
  const course = page.getByLabel('Kolegij u Ducturi', { exact: true });
  const source = page.getByLabel('Kolegij probnog izvora', { exact: true });
  await expect(course).toBeVisible({ timeout: 30_000 });
  await course.selectOption(await firstChoice(course));
  await source.selectOption(await firstChoice(source));
}

if (process.env.DUCTURA_STOG === '1') {
  test.use({ baseURL: webOrigin });
  test.describe.configure({ mode: 'serial' });

  test.describe('val 22: probni ISVU i ulaz iz Studomata (WEB-V22-E2E, dio bez ocjena)', () => {
    test('administrator pregleda i potvrđuje uvoz, ponovljeni pregled nikoga ne upisuje drugi put; axe na 1250 i 400 px', async ({ browser }) => {
      const admin = await signedInPage(browser, ADMIN);
      const { page } = admin;
      try {
        await page.goto(IMPORT_PAGE);
        await expect(page.getByRole('heading', { level: 1, name: IMPORT_TITLE, exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Probni izvor, izmišljeni podaci; nije povezano sa stvarnim ISVU-om.', { exact: true })).toBeVisible();

        await choosePair(page);
        await page.getByRole('button', { name: 'Pregledaj popis', exact: true }).click();
        const preview = page.getByRole('region', { name: 'Pregled popisa', exact: true });
        await expect(preview).toBeVisible({ timeout: 30_000 });
        await expect(preview.getByRole('table', { name: 'Retci probnog izvora' })).toBeVisible();
        await expect(preview.getByText(/^Ukupno redaka: \d+$/)).toBeVisible();
        // A preview enrols nobody and shows no result of an enrolment.
        await expect(page.getByRole('region', { name: 'Rezultat upisa', exact: true })).toHaveCount(0);

        for (const width of [1250, 400]) {
          await page.setViewportSize({ width, height: 900 });
          await axe(page);
        }
        await page.setViewportSize({ width: 1250, height: 900 });

        const confirm = preview.getByRole('button', { name: 'Potvrdi upis…', exact: true });
        const firstRun = await confirm.isVisible();
        if (firstRun) {
          // The seed has the invented source: new students and (account not yet created) unknown_account rows.
          await expect(preview.getByRole('cell', { name: 'Novi student', exact: true }).first()).toBeVisible();
          await confirm.click();
          const dialog = page.getByRole('dialog', { name: 'Potvrda upisa', exact: true });
          await expect(dialog).toBeVisible();
          await expect(dialog.getByText(/^Upisat će se novi studenti: [1-9]\d*\./)).toBeVisible();
          // Cancel changes nothing, the preview stays.
          await dialog.getByRole('button', { name: 'Odustani', exact: true }).click();
          await expect(dialog).toBeHidden();
          await expect(page.getByRole('region', { name: 'Rezultat upisa', exact: true })).toHaveCount(0);

          await confirm.click();
          await page.getByRole('dialog', { name: 'Potvrda upisa', exact: true })
            .getByRole('button', { name: 'Potvrdi upis', exact: true }).click();
          const result = page.getByRole('region', { name: 'Rezultat upisa', exact: true });
          await expect(result).toBeVisible({ timeout: 30_000 });
          await expect(result.getByText(/^Upisano: [1-9]\d*$/)).toBeVisible();
          for (const width of [1250, 400]) {
            await page.setViewportSize({ width, height: 900 });
            await axe(page);
          }
          await page.setViewportSize({ width: 1250, height: 900 });
        } else {
          await expect(preview.getByText('Nema novih studenata za upis.', { exact: true })).toBeVisible();
        }
        test.info().annotations.push({ type: 'prvi prolaz na ovom seedu', description: String(firstRun) });

        // Second preview of the same pair: nobody is new, so nobody can be enrolled a second time.
        await page.getByRole('button', { name: 'Pregledaj popis', exact: true }).click();
        const again = page.getByRole('region', { name: 'Pregled popisa', exact: true });
        await expect(again.getByText('Nema novih studenata za upis.', { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(again.getByRole('button', { name: 'Potvrdi upis…', exact: true })).toHaveCount(0);
        await expect(again.getByText(/^Novi: 0$/)).toBeVisible();
      } finally {
        await admin.context.close();
      }
    });

    test('tuđi i nepoznat kolegij su isti 404; nastavnik dobiva 403, student se vraća na svoju početnu', async ({ browser }) => {
      const admin = await signedInPage(browser, ADMIN);
      const teacher = await signedInPage(browser, 'demo-teacher');
      const student = await signedInPage(browser, 'demo-student');
      try {
        // Courses of this institution come from the administrator's own list; a key of the source from the trial source.
        const years = await admin.page.request.get('/api/v1/institution/admin/academic-years');
        expect(years.status(), 'GET academic-years kao administrator').toBe(200);
        const year = (await years.json()).years[0];
        expect(typeof year, 'akademska godina za probni izvor').toBe('string');
        const source = await admin.page.request.get(`/api/v1/institution/admin/isvu/courses?academicYear=${encodeURIComponent(year)}`);
        expect(source.status(), 'GET isvu/courses kao administrator').toBe(200);
        const sourceCourseKey = (await source.json()).courses[0].sourceCourseKey;

        // Somebody else's course and an unknown one: the same 404, no hint which of the two it is.
        const foreign = await admin.page.request.post(`/api/v1/institution/admin/courses/${randomUUID()}/isvu-roster-imports`, {
          headers: sameOrigin, data: { sourceCourseKey },
        });
        expect(foreign.status(), 'pregled uvoza za nepoznat ili tuđi kolegij').toBe(404);
        const body = await foreign.json();
        const second = await admin.page.request.post(`/api/v1/institution/admin/courses/${randomUUID()}/isvu-roster-imports`, {
          headers: sameOrigin, data: { sourceCourseKey },
        });
        expect(second.status()).toBe(404);
        expect(await second.json(), 'isti odgovor za svaki 404').toEqual(body);

        // A source key the source does not know is a 404 too.
        const own = await admin.page.request.get(`/api/v1/institution/admin/courses?academicYear=${encodeURIComponent(year)}`);
        const firstCourse = (await own.json()).courses?.[0]?.courseId;
        expect(typeof firstCourse, 'kolegij ustanove za ključ izvora').toBe('string');
        {
          const unknown = await admin.page.request.post(`/api/v1/institution/admin/courses/${firstCourse}/isvu-roster-imports`, {
            headers: sameOrigin, data: { sourceCourseKey: `nepoznato-${randomUUID()}` },
          });
          expect(unknown.status(), 'nepoznat ključ kolegija izvora').toBe(404);
        }

        // Not an administrator: 403 on the wire, and the screen does not open for a student.
        const teacherRead = await teacher.page.request.get(`/api/v1/institution/admin/isvu/courses?academicYear=${encodeURIComponent(year)}`);
        expect(teacherRead.status(), 'GET isvu/courses kao nastavnik').toBe(403);
        const teacherPost = await teacher.page.request.post(`/api/v1/institution/admin/courses/${randomUUID()}/isvu-roster-imports`, {
          headers: sameOrigin, data: { sourceCourseKey },
        });
        expect([403, 404], 'pregled uvoza kao nastavnik').toContain(teacherPost.status());
        expect(teacherPost.status(), 'nastavnik nikad ne dobije pregled').not.toBe(200);

        await student.page.goto(IMPORT_PAGE);
        await expect(student.page).toHaveURL(`${webOrigin}${app('/zadaci')}`, { timeout: 30_000 });
        await expect(student.page.getByRole('heading', { name: IMPORT_TITLE })).toHaveCount(0);
      } finally {
        await Promise.all([admin.context.close(), teacher.context.close(), student.context.close()]);
      }
    });

    test('/ulaz/studomat: bez sesije na prijavu AAI@EduHr pa na upis; tuđi parametri se odbacuju, nema otvorenog preusmjeravanja', async ({ browser }) => {
      const courseId = randomUUID();

      // Signed out: the sign-in of the fake AAI@EduHr, back to the enrolment of exactly that course.
      const visitor = await browser.newContext({ baseURL: webOrigin });
      try {
        const page = await visitor.newPage();
        await page.goto(app(`/ulaz/studomat?kolegij=${courseId}`));
        await expect(page).toHaveURL((url) => url.origin === oidcOrigin, { timeout: 30_000 });
        await page.locator('button[name="account"][value="demo-student"]').click();
        await expect(page).toHaveURL((url) => url.origin === webOrigin && url.pathname === app(`/upis/kolegij/${courseId}`), { timeout: 30_000 });
        // The course is unknown: an honest "nije dostupno", not an error page or a blank one.
        await expect(page.getByRole('main')).not.toBeEmpty();
        for (const width of [1250, 400]) {
          await page.setViewportSize({ width, height: 900 });
          await axe(page);
        }

        // Signed in, an invalid id, a repeated parameter, an extra parameter and an outside address are all dropped:
        // the student ends on the home page, never on the outside address, and the link forwards nothing.
        for (const query of [
          'kolegij=nije-uuid',
          `kolegij=${courseId}&kolegij=${randomUUID()}`,
          `x=https://izmisljeno.example/&returnTo=https://izmisljeno.example/`,
          `kolegij=https://izmisljeno.example/`,
        ]) {
          await page.goto(app(`/ulaz/studomat?${query}`));
          await expect(page, `ulaz s upitom ${query}`).toHaveURL(`${webOrigin}${app('/zadaci')}`, { timeout: 30_000 });
        }
      } finally {
        await visitor.close();
      }

      // A teacher with a valid course goes to the teacher's home, not to the student's enrolment.
      const teacher = await signedInPage(browser, 'demo-teacher');
      try {
        await teacher.page.goto(app(`/ulaz/studomat?kolegij=${courseId}`));
        await expect(teacher.page).toHaveURL((url) => url.origin === webOrigin && url.pathname.startsWith(`${appBase}/nastavnik`), { timeout: 30_000 });
        expect(new URL(teacher.page.url()).pathname).not.toContain('/upis/');
      } finally {
        await teacher.context.close();
      }
    });
  });
}
