// WEB-16 editor-e2e (Ductus#2028 c.7008147932), aligned in INT-13 (N07,
// DAN-887) with the system tests: the "Prihvaćanje" steps of WEB-14 (the
// editor page) and WEB-15 (the static toolbar), clicked in what is shipped.
// The student enters through the Preloader on `/` and writes in the
// production build of packages/app under /app/web/ (e2e/sistem/stog.ts), not
// in the frozen Next app of src/app. axe runs at 1250 and 400 px. Only
// made-up data from the server's seed (demo-student, „Seminarski rad: kućno
// kompostiranje”).
//
// It is part of `pnpm test:sistem` and runs in the Sistem workflow
// (.github/workflows/sistem.yml) on the stack it brings up; without that
// stack globalSetup (stog.ts) fails at once with what to start. The file
// sorts before VS-1 and INT-03, which use the same work, so it writes while
// the work is still open; every paragraph it adds is unique to the run and
// the work is left in plain paragraphs and bold, as a student would.
import { expect, test, type Browser, type Page } from '@playwright/test';

import { axe } from '../support/axe.js';
import { app, webOrigin } from './stog';
import { describePageOnFailure, dismissGuide, signInDemoStudent } from './student';

describePageOnFailure();

const ASSIGNMENT_TITLE = 'Seminarski rad: kućno kompostiranje';

// The texts the page shows (packages/ui save-state.ts, packages/editor-core sync/labels.ts).
const SYNCING = 'Sinkroniziram';
const SYNCED = 'Spremljeno na poslužitelju';
const LOCAL = 'Spremljeno na uređaju';
const BLOCKED = 'Dokument je otvoren u drugoj kartici.';

/** The seed assignment's id, read from student.assignments.get, never hard-coded. */
async function seedAssignmentId(page: Page) {
  const response = await page.request.get('/api/v1/student/assignments');
  expect(response.status(), 'GET /api/v1/student/assignments').toBe(200);
  const { courses } = await response.json() as { courses: { assignments: { id: string; title: string }[] }[] };
  const found = courses.flatMap((course) => course.assignments).find((a) => a.title === ASSIGNMENT_TITLE);
  expect(found, `the seed assignment „${ASSIGNMENT_TITLE}”`).toBeTruthy();
  return found!.id;
}

const editorOf = (page: Page) => page.getByRole('textbox', { name: 'Tekst rada', exact: true });
const toolbarOf = (page: Page) => page.getByRole('toolbar', { name: 'Oblikovanje teksta' });
// Only the status bar's chip: the editor has other live regions of its own.
const saveChipOf = (page: Page) => page.locator('footer[aria-label="Stanje rada"]').getByRole('status').first();
const tool = (page: Page, name: string) => toolbarOf(page).getByRole('button', { name, exact: true });

/** Opens the work by its address in the shipped app and waits until it can be written. */
async function openWork(page: Page, id: string) {
  await page.goto(app(`/rad/${id}`));
  await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
  await dismissGuide(page);
}

/**
 * The text is on the server, not only in this browser's journal: a fresh
 * context has no journal (IndexedDB), signs in through the Preloader and
 * opens the work, so what its editor shows came from the server.
 */
async function expectOnServer(browser: Browser, id: string, text: string) {
  const fresh = await browser.newContext({ baseURL: webOrigin });
  try {
    const page = await fresh.newPage();
    await signInDemoStudent(page);
    await openWork(page, id);
    await expect(editorOf(page), 'tekst s poslužitelja u svježem kontekstu').toContainText(text);
  } finally {
    await fresh.close();
  }
}

/** A line unique to this run, so a repeated run never matches an earlier run's text. */
const line = (what: string) => `${what} ${Date.now()}`;

/** True when the caret is in the editor's last block. */
const caretInLastBlock = (page: Page) => editorOf(page).evaluate((editor) => {
  const anchor = window.getSelection()?.anchorNode;
  return anchor != null && editor.lastElementChild != null && editor.lastElementChild.contains(anchor);
});

/**
 * Puts the caret at the end of the text and starts a new paragraph with `text`.
 * The click goes to the last block and the caret is checked there before
 * Enter: ProseMirror settles a click's selection after mouseup, so a
 * Control+End sent at once could be overtaken by the click point.
 */
async function writeParagraph(page: Page, text: string) {
  const editor = editorOf(page);
  await editor.locator(':scope > *').last().click();
  await page.keyboard.press('Control+End');
  await expect.poll(() => caretInLastBlock(page), { message: 'kursor na kraju teksta' }).toBe(true);
  await page.keyboard.press('Enter');
  await page.keyboard.type(text);
  await expect(editor.locator(':scope > *').last()).toHaveText(text);
}

/** Selects the paragraph holding `text` (the caret is in it). */
async function selectParagraph(page: Page, text: string) {
  await editorOf(page).getByText(text, { exact: true }).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
}

test.describe('editor, val 1 (WEB-14, WEB-15) u isporučenom packages/app', () => {
  let assignmentId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await signInDemoStudent(page);
    assignmentId = await seedAssignmentId(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInDemoStudent(page);
  });

  test('WEB-14: piše, sinkronizira, ostaje nakon osvježavanja', async ({ browser, page }) => {
    await openWork(page, assignmentId);
    const text = line('Izmišljeni odlomak o kompostu');
    await writeParagraph(page, text);
    // SYNCING may pass too fast to see; SYNCED is the claim that matters (B-6).
    await expect(saveChipOf(page)).toHaveText(new RegExp(`${SYNCING}|${SYNCED}`));
    await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });

    await page.reload();
    await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
    await expect(editorOf(page)).toContainText(text);
    // G3 (StatusBarLive, evidence-session.ts state()): SYNCED only for a receipt
    // verified in this page session. After a reload the journal's SYNCED reads
    // as on the device until the next verified receipt.
    await expect(saveChipOf(page)).toHaveText(LOCAL);
    await expectOnServer(browser, assignmentId, text);
  });

  test('WEB-14: bez mreže sprema na uređaju, s mrežom opet na poslužitelju', async ({ browser, page, context }) => {
    await openWork(page, assignmentId);
    await context.setOffline(true);
    const text = line('Izmišljeni odlomak bez mreže');
    await writeParagraph(page, text);
    // Offline the chip says so first („Izvan mreže · …”); the claim is the saved state.
    await expect(saveChipOf(page)).toHaveText(new RegExp(`${LOCAL}$`), { timeout: 20_000 });
    await expect(saveChipOf(page)).not.toContainText(SYNCED);

    await context.setOffline(false);
    await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 30_000 });
    await page.reload();
    await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
    await expect(editorOf(page)).toContainText(text);
    await expectOnServer(browser, assignmentId, text);
  });

  test('WEB-14: druga kartica je blokirana', async ({ page, context }) => {
    await openWork(page, assignmentId);
    const second = await context.newPage();
    await second.goto(app(`/rad/${assignmentId}`));
    // The first tab holds the document's lock; the second shows the block (A-12).
    await expect(saveChipOf(second)).toHaveText(BLOCKED, { timeout: 20_000 });
    await expect(editorOf(second)).toHaveAttribute('aria-readonly', 'true');
    await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
    await second.close();
  });

  test('WEB-15: svaki gumb trake mijenja tekst i prati odabir', async ({ page }) => {
    await page.setViewportSize({ width: 1250, height: 900 });
    await openWork(page, assignmentId);
    const editor = editorOf(page);
    const text = line('Izmišljeni odlomak za traku');
    await writeParagraph(page, text);

    const plain = line('Obični izmišljeni odlomak');
    await writeParagraph(page, plain);

    for (const [name, element] of [['Podebljano', 'strong'], ['Kurziv', 'em']] as const) {
      const marked = editor.locator(element, { hasText: text });
      await selectParagraph(page, text);
      await tool(page, name).click();
      await expect(marked).toHaveCount(1);
      await expect(tool(page, name)).toHaveAttribute('aria-pressed', 'true');
      await tool(page, name).click();
      await expect(marked).toHaveCount(0);
      await expect(tool(page, name)).toHaveAttribute('aria-pressed', 'false');
    }

    for (const name of ['Popis', 'Blok-citat']) {
      await selectParagraph(page, text);
      const before = await editor.innerHTML();
      await tool(page, name).click();
      await expect(tool(page, name)).toHaveAttribute('aria-pressed', 'true');
      expect(await editor.innerHTML()).not.toBe(before);
      await tool(page, name).click();
      await expect(tool(page, name)).toHaveAttribute('aria-pressed', 'false');
    }

    // The style menu names the current style; each heading makes the line a heading.
    const style = toolbarOf(page).locator('[data-roving="blockStyle"]');
    const heading = editor.locator('h1, h2, h3, h4', { hasText: text });
    for (const name of ['Naslov rada', 'Poglavlje', 'Potpoglavlje', 'Odlomak']) {
      await selectParagraph(page, text);
      await style.click();
      await page.getByRole('menuitemradio', { name, exact: true }).click();
      await expect(style).toHaveText(new RegExp(`^${name}`));
      await expect(heading).toHaveCount(name === 'Odlomak' ? 0 : 1);
    }

    // The toggles follow the selection: on in the bold line, off in the plain one.
    await selectParagraph(page, text);
    await tool(page, 'Podebljano').click();
    await selectParagraph(page, plain);
    await expect(tool(page, 'Podebljano')).toHaveAttribute('aria-pressed', 'false');
    await selectParagraph(page, text);
    await expect(tool(page, 'Podebljano')).toHaveAttribute('aria-pressed', 'true');

    await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });
  });

  test('WEB-15: Poništi i Ponovi, gumbima i s Ctrl+Z i Ctrl+Y', async ({ page }) => {
    await page.setViewportSize({ width: 1250, height: 900 });
    await openWork(page, assignmentId);
    const editor = editorOf(page);
    const text = line('Izmišljeni odlomak za poništavanje');
    await writeParagraph(page, text);
    const bold = editor.locator('strong', { hasText: text });

    await selectParagraph(page, text);
    await tool(page, 'Podebljano').click();
    await expect(bold).toHaveCount(1);
    await tool(page, 'Poništi').click();
    await expect(bold).toHaveCount(0);
    await tool(page, 'Ponovi').click();
    await expect(bold).toHaveCount(1);

    await page.keyboard.press('Control+Z');
    await expect(bold).toHaveCount(0);
    await page.keyboard.press('Control+Y');
    await expect(bold).toHaveCount(1);

    await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });
    await page.reload();
    await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false', { timeout: 30_000 });
    await expect(editor.locator('strong', { hasText: text })).toHaveCount(1);
  });

  for (const width of [1250, 400]) {
    test(`axe bez nalaza na ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openWork(page, assignmentId);
      await writeParagraph(page, line('Pristupačan izmišljeni odlomak'));
      await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });
      await axe(page);
    });
  }
});
