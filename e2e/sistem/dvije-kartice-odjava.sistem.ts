import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { webOrigin } from './stog';
import { describePageOnFailure, dismissGuide, journalHolds, openDemoWork, signInDemoStudent } from './student';

// INT-20 (A10). Two tabs of one browser share the cookie, the session record and
// the origin's IndexedDB. The student writes in tab A, the sentence stays only
// on the device (the server's answer is withheld), and A signs out. Tab B, open
// on the same work, must stop showing it at once, after a reload, and when
// another student signs in there. The journal itself stays on the device by
// design (accessDenied.heldNote: the student can continue after signing in again).
//
// No commit reaches the server: the context aborts every evidence/commit, so the
// work's revisions stay as VS-1, INT-03 and INT-04 expect them.

describePageOnFailure();

const COMMIT = `${webOrigin}/api/v1/evidence/commit`;

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Odjava', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Odjava' });
  // With text that is only on the device the editor offers export first; the test leaves without it.
  await dialog.getByRole('button', { name: /^Odjavi se/ }).first().click();
  await expect(page).toHaveURL((url) => url.origin === webOrigin && url.pathname === '/');
}

test('INT-20: odjava u kartici A, kartica B ne vidi lokalni dnevnik ni opseg kartice A', async ({ browser }) => {
  const sentence = `Rečenica samo na uređaju kartice A (A10 ${randomUUID()}).`;
  const context = await browser.newContext({ baseURL: webOrigin });
  try {
    await context.route(COMMIT, (route) => route.abort());
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    const editorOf = (page: Page) => page.getByRole('textbox', { name: 'Tekst rada', exact: true });

    const workPath = await test.step('A: prijava, otvaranje rada i rečenica u lokalnom dnevniku', async () => {
      await signInDemoStudent(tabA);
      const path = await openDemoWork(tabA);
      await dismissGuide(tabA);
      const editor = editorOf(tabA);
      await expect(editor).toBeEditable();
      await editor.click();
      await tabA.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
      await tabA.keyboard.press('Enter');
      await tabA.keyboard.insertText(sentence);
      await expect.poll(() => journalHolds(tabA, sentence), { message: 'rečenica u lokalnom dnevniku (IndexedDB)' }).toBe(true);
      return path;
    });

    await test.step('B: ista sesija prije odjave vidi isti rad', async () => {
      await tabB.goto(workPath);
      await expect(tabB).toHaveURL(`${webOrigin}${workPath}`);
      await expect(editorOf(tabB)).toBeVisible();
      const me = await tabB.request.get('/api/v1/me');
      await expect(me).toBeOK();
    });

    await test.step('A: odjava', async () => {
      await tabA.bringToFront();
      await signOut(tabA);
      const me = await tabA.request.get('/api/v1/me');
      expect(me.ok(), 'nakon odjave /api/v1/me ne vraća korisnika').toBe(false);
    });

    await test.step('B bez osvježavanja: rečenica iz kartice A nije prikazana', async () => {
      await tabB.bringToFront();
      // The session-end channel reaches B without a reload (src/client/session-end.ts).
      await expect(tabB.getByText(sentence)).toBeHidden({ timeout: 15_000 });
    });

    await test.step('B nakon osvježavanja: traži prijavu, bez rečenice i bez rada', async () => {
      await tabB.reload();
      await tabB.waitForLoadState('networkidle');
      await expect(tabB.getByText(sentence)).toHaveCount(0);
      await expect(editorOf(tabB)).toHaveCount(0);
      const me = await tabB.request.get('/api/v1/me');
      expect(me.ok()).toBe(false);
    });

    await test.step('B: drugi student u istom pregledniku ne vidi rad ni dnevnik kartice A', async () => {
      await signInDemoStudent(tabB, 'demo-student-2');
      const me = await tabB.request.get('/api/v1/me');
      await expect(me).toBeOK();
      await expect(tabB.getByText(sentence)).toHaveCount(0);
      await tabB.goto(workPath);
      await tabB.waitForLoadState('networkidle');
      await expect(tabB.getByText(sentence)).toHaveCount(0);
    });
  } finally {
    await context.close();
  }
});
