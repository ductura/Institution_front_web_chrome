import { createHash, randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { createTextAnchor } from '../../packages/editor-core/src/document/collaboration/anchor';
import { isNodeId } from '../../packages/editor-core/src/document/document/schema';
import { teacherCommentsMessages as commentText } from '../../packages/app/src/host/teacher/comments/messages.hr';
import { fastPathHostText } from '../../packages/app/src/host/teacher/n05/messages.hr';
import { messagesHr as t } from '../../src/lib/i18n/messages.hr';
import { app, webOrigin } from './stog';
import { UNCONFIRMED_V2, describePageOnFailure, openDemoAssignment, signInDemoStudent, signInThroughPreloader } from './student';

describePageOnFailure();

const title = 'Seminarski rad: kućno kompostiranje';
const course = 'Izmišljeni seminar iz ekologije grada';
const otherCourse = 'Izmišljeni seminar o gradskim krovovima';
const studentName = /Lucija Đaković/;
/** How the thread should name the revision it belongs to (INT-15); no screen shows it yet. */
const revisionV1 = 'uz verziju V1';

/** Set by INT-04 once the teacher's comment from the form is on screen; INT-15 reopens it. */
let commentedInUi: { workPath: string; comment: string } | null = null;

function commentsPanel(page: Page) {
  return page.getByRole('region', { name: commentText.title, exact: true });
}

async function signInTeacher(page: Page, courseTeacher: boolean) {
  await signInThroughPreloader(page, courseTeacher ? 'demo-teacher' : async (oidc) => {
    await oidc.getByLabel('Domena ustanove').fill('demo.ductus.test');
    await oidc.getByLabel('Uloga').selectOption('nastavnik');
    await oidc.getByLabel('Korisničko ime (neobavezno)').fill('demo-int04-nastavnik');
    await oidc.getByRole('button', { name: 'Prijavi se', exact: true }).click();
  });
  await expect(page, courseTeacher ? 'Prijava nastavnika kolegija.' : 'Za drugog nastavnika učitaj seed-int04.sql.').toHaveURL(`${webOrigin}${app('/nastavnik')}`);
  const profile = await page.request.get('/api/v1/me');
  await expect(profile).toBeOK();
  expect(await profile.json()).toMatchObject({
    institution: { slug: 'demo-fakultet' }, roles: expect.arrayContaining(['teacher']),
  });
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
    const { assignmentId } = await openDemoAssignment(page);
    const response = await page.request.get(`/api/v1/student/assignments/${assignmentId}/submission`);
    await expect(response).toBeOK();
    const submission = await response.json();
    expect(submission, 'Prvo završi INT-03 na istoj bazi.').toMatchObject({
      state: 'potvrdeno',
      receipt: { payload: { assignmentId, documentId: expect.any(String), artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/) } },
    });
    return submission.receipt.payload as { assignmentId: string; documentId: string; artifactSha256: string };
  });
  const fastPath = app(`/nastavnik/brz-put?zadatak=${encodeURIComponent(assignmentId)}`);
  const workPath = app(`/nastavnik/rad/${encodeURIComponent(documentId)}`);
  const liveApi = `/api/v1/live/${encodeURIComponent(documentId)}`;
  const teacher = await browser.newContext({ baseURL: webOrigin });
  const other = await browser.newContext({ baseURL: webOrigin });

  try {
    const teacherPage = await teacher.newPage();
    const { quote, nodeId } = await test.step('U Brzom putu otvori istu predaju i usporedi predani tekst', async () => {
      await signInTeacher(teacherPage, true);
      // N-01 of packages/app lists the teacher's courses without a per-assignment link to "Brz put"
      // (AssignmentFacts links /nastavnik/brz-put without ?zadatak=; open finding in INT-10), so
      // the course is checked on the home page and "Brz put" is opened by its address.
      await expect(teacherPage.getByRole('heading', { name: course, exact: true })).toBeVisible();
      await teacherPage.goto(fastPath);
      await expect(teacherPage).toHaveURL(fastPath);
      const submitted = teacherPage.getByRole('navigation', { name: t.fastPath.studentsLabel }).getByRole('link', { name: studentName });
      await expect(submitted.getByText(fastPathHostText.work.submitted, { exact: true })).toBeVisible();
      await submitted.click();
      const openWork = teacherPage.getByRole('link', { name: t.fastPath.openWork, exact: true });
      await expect(openWork).toHaveAttribute('href', workPath);
      const [live] = await Promise.all([
        teacherPage.waitForResponse((response) => response.url() === `${webOrigin}${liveApi}` && response.request().method() === 'GET', { timeout: 30_000 }),
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
      // INT-14: the teacher sees exactly V1, without the student's unconfirmed local V2.
      await expect(teacherPage.getByRole('document', { name: t.liveView.documentLabel })).not.toContainText(UNCONFIRMED_V2);
      const quote = await paragraph.innerText();
      const nodeId = await paragraph.getAttribute('data-node-id');
      if (!isNodeId(nodeId)) throw new Error('U predanom odlomku nema valjanog identifikatora za sidro komentara.');
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
        expect.objectContaining({ threadId: created.body.id, position: 1, authorRole: 'teacher', isOwn: true, body: comment, anchor }),
      ]));
    });

    await test.step('Kroz obrazac na prikazu rada komentiraj predanu V1 i vidi komentar u niti', async () => {
      const uiComment = `Navedite izvor za udio lišća u kompostu (${randomUUID()}).`;
      const paragraph = teacherPage.getByRole('document', { name: t.liveView.documentLabel })
        .locator(`p[data-node-id="${nodeId}"]`);
      // The panel opens the form for the passage marked in the text (mouseup on the document).
      await paragraph.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        if (!selection) throw new Error('Preglednik nema odabira teksta.');
        selection.removeAllRanges();
        selection.addRange(range);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      const panel = commentsPanel(teacherPage);
      const form = panel.getByRole('form', { name: commentText.newTitle, exact: true });
      await expect(form).toBeVisible();
      await expect(form).toContainText(quote.trim().slice(0, 30));
      const [created] = await Promise.all([
        teacherPage.waitForResponse((response) => response.url() === `${webOrigin}/api/v1/comments/create`
          && response.request().method() === 'POST'),
        (async () => {
          await form.getByRole('textbox', { name: commentText.newLabel, exact: true }).fill(uiComment);
          await form.getByRole('button', { name: commentText.newSubmit, exact: true }).click();
        })(),
      ]);
      expect(created.status()).toBe(200);
      expect(created.request().postDataJSON()).toMatchObject({ documentId, body: uiComment, anchor: { nodeId } });
      await expect(panel.getByRole('status').filter({ hasText: commentText.added })).toBeVisible();
      const thread = panel.getByRole('article').filter({ hasText: uiComment });
      await expect(thread).toHaveCount(1);
      await expect(thread.getByText(uiComment, { exact: true })).toBeVisible();
      await expect(thread.getByText(new RegExp(`^${commentText.own} · `))).toBeVisible();
      commentedInUi = { workPath, comment: uiComment };
    });

    await test.step('Drugi nastavnik iz iste ustanove ne vidi predaju ni kroz popis ni izravnim otvaranjem', async () => {
      const otherPage = await other.newPage();
      await signInTeacher(otherPage, false);
      await expect(otherPage.getByRole('heading', { name: otherCourse, exact: true })).toBeVisible();
      await expect(otherPage.getByText(title, { exact: true })).toHaveCount(0);
      const [foreignList] = await Promise.all([
        otherPage.waitForResponse((response) => response.url() === `${webOrigin}/api/v1/teacher/fast-path`
          && response.request().method() === 'POST' && response.request().postDataJSON()?.assignmentId === assignmentId),
        otherPage.goto(fastPath),
      ]);
      expect(foreignList.status()).toBe(200);
      expect(await foreignList.json()).toEqual({ kind: 'ok', students: [] });
      await expect(otherPage.getByText(fastPathHostText.emptyText, { exact: true })).toBeVisible();
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
      expect(comments.body).toMatchObject({ code: 'forbidden' });
    });
  } finally {
    await Promise.all([teacher.close(), other.close()]);
  }
});

test('INT-15: komentar nastavnika iz obrasca prikazan je uz reviziju V1', async ({ page }) => {
  const opened = await test.step('Ponovno otvori rad i nađi komentar iz INT-04', async () => {
    const earlier = commentedInUi;
    if (earlier === null) throw new Error('Prvo mora proći korak obrasca u INT-04 u istom pokretanju.');
    const { workPath, comment } = earlier;
    await signInTeacher(page, true);
    await page.goto(workPath);
    await expect(page).toHaveURL(workPath);
    const thread = commentsPanel(page).getByRole('article').filter({ hasText: comment });
    await expect(thread.getByText(comment, { exact: true })).toBeVisible();
    return thread;
  });

  await test.step('Nit komentara navodi reviziju V1', async () => {
    // Expected failure from here on only: collaboration.comments.post (create and list) carries no
    // revision, so neither the server nor the panel can tie the comment to V1. The steps above must
    // still pass. Remove this line once the contract and the panel name the revision.
    test.fail(true, 'PITANJE INT-15: collaboration.comments.post ne nosi reviziju komentara (create ni list).');
    await expect(opened.getByText(revisionV1, { exact: false })).toBeVisible({ timeout: 5_000 });
  });
});
