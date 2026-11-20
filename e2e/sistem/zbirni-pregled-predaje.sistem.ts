import { createHash, randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { createTextAnchor } from '../../packages/editor-core/src/document/collaboration/anchor';
import { messagesHr as t } from '../../src/lib/i18n/messages.hr';
import { oidcOrigin, webOrigin } from './stog';
import { openDemoWork, signInDemoStudent } from './student';

const title = 'Seminarski rad: kućno kompostiranje';
const otherCourse = 'Izmišljeni seminar o gradskim krovovima';
const studentName = /Lucija.*Đaković|Đaković.*Lucija/;

async function signInTeacher(page: Page, courseTeacher: boolean) {
  await page.goto('/prijava?returnTo=%2Fnastavnik');
  await page.getByRole('link', { name: 'Prijava sustavom AAI@EduHr', exact: true }).click();
  await expect(page).toHaveURL((url) => url.origin === oidcOrigin);
  if (courseTeacher) {
    await page.locator('button[name="account"][value="demo-teacher"]').click();
  } else {
    await page.getByLabel('Domena ustanove').fill('demo.ductus.test');
    await page.getByLabel('Uloga').selectOption('nastavnik');
    await page.getByLabel('Korisničko ime (neobavezno)').fill('demo-int04-nastavnik');
    await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
  }
  await expect(page, 'Za drugog nastavnika potrebno je učitati seed-int04.sql.').toHaveURL(`${webOrigin}/nastavnik`);
  const access = await page.request.get('/api/v1/teacher/access');
  await expect(access).toBeOK();
  expect(await access.json()).toMatchObject({ access: 'allowed' });
}

function postFromBrowser(page: Page, path: string, data: object) {
  return page.evaluate(async ({ path, data }) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, { path, data });
}

test('INT-04: nastavnik otvara predaju, pregledava sažetak i komentira, drugi kolegij nema pristup', async ({ page, browser }) => {
  const { assignmentId, documentId, artifactSha256 } = await test.step('Pronađi spremljenu potvrdu iz INT-03', async () => {
    await signInDemoStudent(page);
    const assignmentId = (await openDemoWork(page)).slice('/rad/'.length);
    const response = await page.request.get(`/api/v1/student/assignments/${assignmentId}/submission`);
    await expect(response).toBeOK();
    const submission = await response.json();
    expect(submission, 'Prvo završi INT-03 na istoj bazi.').toMatchObject({
      state: 'potvrdeno',
      receipt: { payload: { assignmentId, documentId: expect.any(String), artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/) } },
    });
    return submission.receipt.payload as { assignmentId: string; documentId: string; artifactSha256: string };
  });
  const fastPath = `/nastavnik/brz-put?zadatak=${encodeURIComponent(assignmentId)}`;
  const workPath = `/nastavnik/rad/${encodeURIComponent(documentId)}`;
  const liveApi = `/api/v1/live/${encodeURIComponent(documentId)}`;
  const teacher = await browser.newContext({ baseURL: webOrigin });
  const other = await browser.newContext({ baseURL: webOrigin });

  try {
    const teacherPage = await teacher.newPage();
    const { quote, nodeId } = await test.step('U Brzom putu otvori istu predaju i usporedi predani tekst', async () => {
      await signInTeacher(teacherPage, true);
      const assignment = teacherPage.getByRole('listitem').filter({ has: teacherPage.getByText(title, { exact: true }) });
      await assignment.getByRole('link', { name: t.fastPath.title, exact: true }).click();
      await expect(teacherPage).toHaveURL(fastPath);
      const submitted = teacherPage.getByRole('navigation', { name: t.fastPath.studentsLabel }).getByRole('button', { name: studentName });
      await expect(submitted.getByText(t.fastPath.work.submitted, { exact: true })).toBeVisible();
      await submitted.click();
      const openWork = teacherPage.getByRole('link', { name: t.fastPath.openWork, exact: true });
      await expect(openWork).toHaveAttribute('href', workPath);
      const [live] = await Promise.all([
        teacherPage.waitForResponse((response) => response.url() === `${webOrigin}${liveApi}` && response.request().method() === 'GET'),
        openWork.click(),
      ]);
      expect(live.status()).toBe(200);
      expect(live.headers()['ductus-live-state']).toBe('submitted');
      expect(createHash('sha256').update(await live.body()).digest('hex')).toBe(artifactSha256);
      await expect(teacherPage).toHaveURL(workPath);
      await expect(teacherPage.getByRole('status').filter({ hasText: t.liveView.submitted })).toBeVisible();
      const paragraph = teacherPage.getByRole('document', { name: t.liveView.documentLabel })
        .locator('p[data-node-id]').filter({ hasText: 'U izmišljenom vrtu kompostiramo lišće' });
      await expect(paragraph).toBeVisible();
      const quote = await paragraph.innerText();
      const nodeId = await paragraph.getAttribute('data-node-id');
      if (!nodeId) throw new Error('U predanom odlomku nedostaje identifikator za sidro komentara.');
      return { quote, nodeId };
    });

    await test.step('Pregledaj prikaz učitanog zapisa procesa', async () => {
      const summary = teacherPage.getByRole('region', { name: t.summary.title });
      await expect(summary.locator('[data-record-state]')).toHaveAttribute('data-record-state', /^(complete|has_gaps)$/);
    });

    const comment = `Pojasnite odabir lišća za kompostiranje (${randomUUID()}).`;
    await test.step('Spremi komentar uz predani odlomak i ponovno ga pročitaj s poslužitelja', async () => {
      const anchor = createTextAnchor({ nodeId, nodeText: quote, start: 0, end: quote.length });
      const created = await postFromBrowser(teacherPage, '/api/v1/comments/create', { documentId, body: comment, anchor });
      expect(created.status).toBe(200);
      expect(created.body).toMatchObject({ id: expect.any(String) });
      const listed = await postFromBrowser(teacherPage, '/api/v1/comments/list', { documentId });
      expect(listed.status).toBe(200);
      expect(listed.body.comments).toEqual(expect.arrayContaining([
        expect.objectContaining({ commentId: created.body.id, authorRole: 'teacher', isOwn: true, body: comment, anchor }),
      ]));
    });

    await test.step('Drugi nastavnik iz iste ustanove ne vidi predaju ni kroz popis ni izravnim otvaranjem', async () => {
      const otherPage = await other.newPage();
      await signInTeacher(otherPage, false);
      await expect(otherPage.getByRole('heading', { name: otherCourse, exact: true })).toBeVisible();
      await expect(otherPage.getByText(title, { exact: true })).toHaveCount(0);
      await otherPage.goto(fastPath);
      await expect(otherPage.getByText(t.fastPath.empty, { exact: true })).toBeVisible();
      await expect(otherPage.getByRole('link', { name: t.fastPath.openWork, exact: true })).toHaveCount(0);

      const [denied] = await Promise.all([
        otherPage.waitForResponse((response) => response.url() === `${webOrigin}${liveApi}` && response.request().method() === 'GET'),
        otherPage.goto(workPath),
      ]);
      expect(denied.status()).toBe(404);
      await expect(otherPage.getByRole('document', { name: t.liveView.documentLabel })).toHaveText(t.liveView.connection.notFound);
      const summary = await postFromBrowser(otherPage, '/api/v1/process-summary', { documentId });
      expect(summary.status).toBe(404);
      const comments = await postFromBrowser(otherPage, '/api/v1/comments/list', { documentId });
      expect(comments.status).toBe(403);
    });
  } finally {
    await Promise.all([teacher.close(), other.close()]);
  }
});
