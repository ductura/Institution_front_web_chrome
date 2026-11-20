// WEB-36 nastavnik-e2e (Ductus#2028 c.7009405737): the "Prihvaćanje" steps of
// WEB-31..WEB-35 clicked on the local stack as `demo-teacher`: students by
// group → live work → submission receipt; the assignment overview; the
// mentorship requests (approve the request of `demo-student-5`); then
// `demo-student-3` sees the same fingerprint and the teacher's opening in the
// access log. axe at 1250 and 400 px on every teacher page. Only made-up data
// from the server's seed (SRV-17, SRV-26), never real names or texts: names
// are read at run time from /api/v1/me of each seed account.
//
// Like editor-val1.spec.js and predaja-val3.spec.js these tests need the whole
// local stack, so they are registered only with DUCTURA_STOG=1 (without it they
// do not exist, rather than being skipped). To run them:
//
//   1. Institution_server: `pnpm lokalno --izravno` (server :4000, fake OIDC
//      :8090, PostgreSQL with the seed and `scripts/lokalno/seed-predaja.ts`).
//      Start from a fresh seed: approving a mentorship request cannot be
//      undone, so a second run fails at the mentorship test with a message
//      saying so. Run this file before predaja-val3.spec.js (alphabetical
//      order does that): that one submits `demo-student`'s work, which the
//      overview here expects unsubmitted.
//   2. This repo: `pnpm next:dev` (:3000).
//   3. `DUCTURA_STOG=1 pnpm test:functional --project=chromium e2e/nastavnik-val5.spec.js`
//
// Everything is opened on `localhost`, never `127.0.0.1` (the session cookie
// belongs to the host the callback set it on). Chromium is the column this was
// written for.
//
// Needs, besides the stack: SRV-26 (seed), SRV-29/30/31 (handlers), contracts
// 3.2.0 and the reads the pages still mark TODO(ugovor) (WEB-31 roster, WEB-32
// requests, WEB-33 overview, WEB-34 live text, WEB-35 receipt). Until those
// land the first test of each part fails on the page's "unavailable" alert.
//
// Not covered, by decision: record gaps (P-3, no gap from the public API; the
// unit tests of AssignmentOverview and ReceiptPanel hold that variant), the
// access-log row of reading the receipt (P-5 decides its surface), the
// receipt signature (P-4).
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';

const WEB = process.env.DUCTURA_STOG_WEB ?? 'http://localhost:3000';
const OIDC = process.env.DUCTURA_STOG_OIDC ?? 'http://localhost:8090';
const TEACHER = 'demo-teacher';
const SUBMITTED = 'demo-student-3'; // group B, submitted in the seed (SRV-17)
const UNSUBMITTED = 'demo-student'; // group A, not submitted before predaja-val3
const REQUESTER = 'demo-student-5'; // sent a mentorship request (SRV-26)
const ASSIGNMENT_TITLE = 'Seminarski rad: kućno kompostiranje';

// Texts as the pages show them (src/lib/i18n/messages.hr.ts, packages/ui).
const ROSTER_UNAVAILABLE = 'Popis studenata trenutačno nije dostupan.';
const OPEN_SEMINAR = 'Otvori seminarski rad';
const TO_SUBMISSION = 'Predaja rada';
const RECEIPT_TITLE = 'Potvrda predaje';
const OVERVIEW_UNAVAILABLE = 'Zbirni pregled trenutačno nije dostupan. Pokušajte ponovno.';
const REQUESTS_TITLE = 'Zahtjevi za mentorstvo';
const REQUESTS_UNAVAILABLE = 'Zahtjevi za mentorstvo trenutačno nisu dostupni. Pokušajte ponovno.';
const APPROVED = 'Zahtjev je odobren. Rad je u popisu radova uz mentora.';
const DECISION_UNKNOWN = 'Nije poznato je li odluka zabilježena. Osvježite stranicu prije novog pokušaja.';
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Fails at once with what to start, instead of each test timing out. */
async function reachable(url, what) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
  } catch (error) {
    throw new Error(`${what} se ne javlja na ${url} (${error.message}); vidi zaglavlje datoteke.`);
  }
}

/** Signs in as a seed account in its own context; returns the page and the account's displayName. */
async function signIn(browser, account) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${WEB}/api/v1/auth/login?returnTo=${encodeURIComponent('/')}`);
  await expect(page).toHaveURL((url) => url.origin === new URL(OIDC).origin);
  await page.locator(`button[name="account"][value="${account}"]`).click();
  await page.waitForURL((url) => url.origin !== new URL(OIDC).origin && !url.pathname.endsWith('/auth/callback'));
  const me = await page.request.get(`${WEB}/api/v1/me`);
  expect(me.status(), `GET /api/v1/me as ${account}`).toBe(200);
  const { displayName } = await me.json();
  expect(displayName, `the seed name of ${account}`).toBeTruthy();
  return { page, name: displayName };
}

/** GET through the web's /api/v1 under the page's session, 200 or the test fails with the route. */
async function getJson(page, path) {
  const response = await page.request.get(`${WEB}/api/v1${path}`);
  expect(response.status(), `GET /api/v1${path}`).toBe(200);
  return response.json();
}

const heading = (page, name) => page.getByRole('heading', { level: 1, name, exact: true });

/** The digest as Fingerprint shows it: groups of four, joined, lower case like the receipt's hex. */
async function shownFingerprint(page) {
  const groups = await page.locator('code span').allTextContents();
  return groups.join('').toLowerCase();
}

if (process.env.DUCTURA_STOG === '1') {
  // One flow on one seed: the tests run in this order, each building on the one before.
  test.describe.serial('nastavnik vidi predaju, val 5 (WEB-31..WEB-35) na lokalnom stogu', () => {
    let teacher;
    let submitted;
    let unsubmitted;
    let requester;
    let course;
    let assignment;
    let studentAssignmentId;
    let workHref;
    let fingerprint;

    test.beforeAll(async ({ browser }) => {
      await reachable(`${WEB}/`, 'Next (pnpm next:dev)');
      await reachable(`${OIDC}/`, 'Lažni OIDC (pnpm lokalno)');
      await reachable(`${WEB}/api/v1/health`, 'Institution_server kroz /api/v1');
      [submitted, unsubmitted, requester, teacher] = [
        await signIn(browser, SUBMITTED), await signIn(browser, UNSUBMITTED),
        await signIn(browser, REQUESTER), await signIn(browser, TEACHER),
      ];
      const { courses } = await getJson(teacher.page, '/teacher/courses');
      course = courses.find((c) => c.assignments.some((a) => a.title === ASSIGNMENT_TITLE));
      expect(course, `demo-teacher's course with „${ASSIGNMENT_TITLE}”`).toBeTruthy();
      assignment = course.assignments.find((a) => a.title === ASSIGNMENT_TITLE);
      const own = await getJson(submitted.page, '/student/assignments');
      studentAssignmentId = own.courses.flatMap((c) => c.assignments).find((a) => a.title === ASSIGNMENT_TITLE)?.id;
      expect(studentAssignmentId, `demo-student-3's „${ASSIGNMENT_TITLE}”`).toBeTruthy();
    });

    test.afterAll(async () => {
      for (const who of [teacher, submitted, unsubmitted, requester]) await who?.page.context().close();
    });

    const studentsHref = () => `${WEB}/nastavnik/kolegiji/${encodeURIComponent(course.id)}/studenti`;
    const rosterRow = (page, name) => page.getByRole('listitem').filter({ hasText: name });

    test('studenti: obje grupe, filtar grupe B pokazuje samo demo-student-3', async () => {
      const { page } = teacher;
      await page.goto(studentsHref());
      await expect(page.getByText(ROSTER_UNAVAILABLE)).toHaveCount(0);
      await expect(rosterRow(page, submitted.name)).toHaveCount(1);
      await expect(rosterRow(page, unsubmitted.name)).toHaveCount(1);

      // #f-gr: "Svi (n)" and one option per group with its count.
      const filter = page.locator('#f-gr select');
      const groupB = (await filter.locator('option').allTextContents()).find((label) => /\bB \(\d+\)$/.test(label));
      expect(groupB, 'an option for group B in #f-gr').toBeTruthy();
      await filter.selectOption({ label: groupB });
      await expect(rosterRow(page, submitted.name)).toHaveCount(1);
      await expect(rosterRow(page, unsubmitted.name)).toHaveCount(0);
      await expect(rosterRow(page, submitted.name)).toContainText(` · `);
    });

    test('rad: „Otvori seminarski rad” vodi na rad uživo s poveznicom na predaju', async () => {
      const { page } = teacher;
      const row = rosterRow(page, submitted.name);
      await row.getByRole('link', { name: OPEN_SEMINAR }).first().click();
      await page.waitForURL(/\/nastavnik\/rad\/[^/]+$/);
      workHref = page.url();
      await expect(page.getByText('Prikaz teksta uživo još nije dostupan na ovoj stranici.')).toHaveCount(0);
      // A submitted work: the bar "nije predano" is absent and N-07 is one link away.
      await expect(page.getByText('Rad još nije predan.')).toHaveCount(0);
      await expect(page.getByRole('link', { name: TO_SUBMISSION, exact: true })).toBeVisible();
    });

    test('predaja: potvrda s otiskom, ista komponenta kao kod studenta', async () => {
      const { page } = teacher;
      await page.getByRole('link', { name: TO_SUBMISSION, exact: true }).click();
      await page.waitForURL(`${workHref}/predaja`);
      await expect(heading(page, RECEIPT_TITLE)).toBeVisible();
      await expect(page.getByText(submitted.name)).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      fingerprint = await shownFingerprint(page);
      expect(fingerprint).toMatch(SHA256_HEX);
    });

    test('zbirni: predano i nepredano u zadatku iz seeda, sortiranje tipkovnicom', async () => {
      const { page } = teacher;
      await page.goto(`${WEB}/nastavnik/zbirni?zadatak=${encodeURIComponent(assignment.id)}`);
      await expect(page.getByText(OVERVIEW_UNAVAILABLE)).toHaveCount(0);
      const table = page.getByRole('table', { name: `Predaje zadatka ${ASSIGNMENT_TITLE}` });
      await expect(table).toBeVisible();
      const row = (name) => table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(name) }) });
      await expect(row(submitted.name)).toContainText('Predano');
      await expect(row(unsubmitted.name)).toContainText('Nije predano');
      // A submitted row leads to N-07 of that work.
      await expect(row(submitted.name).getByRole('link')).toHaveAttribute('href', new URL(`${workHref}/predaja`).pathname);

      // DataTable: the sort button of "Vrijeme predaje", from the keyboard; aria-sort says the order.
      const header = table.getByRole('columnheader', { name: /Vrijeme predaje/ });
      const before = await header.getAttribute('aria-sort');
      await header.getByRole('button').focus();
      await page.keyboard.press('Enter');
      await expect(header).not.toHaveAttribute('aria-sort', before ?? 'none');
      const order = await header.getAttribute('aria-sort');
      expect(['ascending', 'descending']).toContain(order);
      const times = (await table.locator('tbody time').evaluateAll((all) => all.map((t) => Date.parse(t.dateTime))));
      const sorted = [...times].sort((a, b) => (order === 'ascending' ? a - b : b - a));
      expect(times).toEqual(sorted);
    });

    test('zbirni: jedan od zadataka nastavnika ima predaju nakon roka', async () => {
      const { page } = teacher;
      const { courses } = await getJson(page, '/teacher/courses');
      let late = null;
      for (const a of courses.flatMap((c) => c.assignments)) {
        const overview = await getJson(page, `/teacher/assignments/${encodeURIComponent(a.id)}/overview`);
        // TODO(ugovor): the body of teacher.assignment-overview.get as src/client/teacher-reads.ts reads it.
        if (overview.rows.some((r) => r.submitted && r.afterDeadline)) { late = a; break; }
      }
      expect(late, 'a seed submission after the deadline in an assignment of demo-teacher (SRV-17, SRV-29)').toBeTruthy();
      await page.goto(`${WEB}/nastavnik/zbirni?zadatak=${encodeURIComponent(late.id)}`);
      const table = page.getByRole('table', { name: `Predaje zadatka ${late.title}` });
      await expect(table.getByRole('cell', { name: /Nakon roka/ }).first()).toBeVisible();
    });

    test('mentorstva: bez mreže nema poruke o uspjehu, zahtjev ostaje', async () => {
      const { page } = teacher;
      await page.goto(`${WEB}/nastavnik/mentorstva`);
      await expect(page.getByText(REQUESTS_TITLE)).toBeVisible();
      await expect(page.getByText(REQUESTS_UNAVAILABLE)).toHaveCount(0);
      const approve = page.getByRole('button', { name: `Odobri: ${requester.name}` });
      // An approved request has left the list: the run needs a fresh seed.
      await expect(approve, 'zahtjev demo-student-5 nije na popisu; pokreni na svježem seedu (vidi zaglavlje)').toBeVisible();

      // B-6: a note of success only after the server's answer.
      await page.context().setOffline(true);
      await approve.click();
      await expect(page.getByText(DECISION_UNKNOWN)).toBeVisible();
      await expect(page.getByText(APPROVED)).toHaveCount(0);
      await page.context().setOffline(false);
      await page.reload();
      await expect(approve).toBeVisible();
    });

    test('mentorstva: odobren zahtjev demo-student-5 prelazi u radove uz mentora', async () => {
      const { page } = teacher;
      await page.getByRole('button', { name: `Odobri: ${requester.name}` }).click();
      await expect(page.getByRole('status').filter({ hasText: APPROVED })).toBeVisible();
      await expect(page.getByRole('button', { name: `Odobri: ${requester.name}` })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('button', { name: `Odobri: ${requester.name}` })).toHaveCount(0);
      await expect(page.getByRole('listitem').filter({ hasText: requester.name }).filter({ hasText: 'Otvori rad' })).toHaveCount(1);
    });

    const teacherPages = [
      ['popis studenata', () => studentsHref()],
      ['zbirni pregled', () => `${WEB}/nastavnik/zbirni?zadatak=${encodeURIComponent(assignment.id)}`],
      ['mentorstva', () => `${WEB}/nastavnik/mentorstva`],
      ['rad uživo', () => workHref],
      ['potvrda predaje', () => `${workHref}/predaja`],
    ];
    for (const [what, href] of teacherPages) {
      for (const width of [1250, 400]) {
        test(`axe bez nalaza: ${what} na ${width} px`, async () => {
          const { page } = teacher;
          await page.setViewportSize({ width, height: 900 });
          await page.goto(href());
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await axe(page);
        });
      }
    }

    test('demo-student-3 vidi isti otisak kao nastavnik', async () => {
      const { page } = submitted;
      await page.goto(`${WEB}/rad/${studentAssignmentId}/predaja`);
      await page.waitForURL(`${WEB}/rad/${studentAssignmentId}/predaja/potvrda`);
      await expect(heading(page, RECEIPT_TITLE)).toBeVisible();
      expect(await shownFingerprint(page)).toBe(fingerprint);
    });

    test('demo-student-3 u dnevniku pristupa vidi da je nastavnik otvorio rad uživo', async () => {
      const { page } = submitted;
      await page.goto(`${WEB}/rad/${studentAssignmentId}/dnevnik-pristupa`);
      await expect(heading(page, 'Tko je otvorio Vaš rad')).toBeVisible();
      await expect(page.getByText('Dnevnik trenutačno nije moguće učitati.', { exact: false })).toHaveCount(0);
      // live_view of N-06 (#351) by the course teacher; the row for reading the receipt waits on P-5.
      const rows = page.locator('li.access-log__row');
      await expect(rows.filter({ hasText: 'nastavnik kolegija' }).filter({ hasText: 'Rad uživo' }).first()).toBeVisible();
      for (const width of [1250, 400]) {
        await page.setViewportSize({ width, height: 900 });
        await axe(page);
      }
    });
  });
}
