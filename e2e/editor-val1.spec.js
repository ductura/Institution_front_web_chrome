// WEB-16 editor-e2e (Ductus#2028 c.7008147932): the "Prihvaćanje" steps of
// WEB-14 (the editor page) and WEB-15 (the static toolbar), clicked on the
// local stack, with axe at 1250 and 400 px. Only made-up data from the
// server's seed (demo-student, „Seminarski rad: kućno kompostiranje”).
//
// These tests need the whole local stack, so they are registered only with
// DUCTURA_STOG=1. Without it they do not exist, rather than being skipped,
// as with the branded browsers in playwright.config.js. To run them:
//
//   1. Institution_server: `pnpm lokalno --izravno` (server :4000, fake
//      OIDC :8090, PostgreSQL with seed.sql). With the edge proxy (:8000) the
//      sign-in works the same way: the callback lands outside Next and the
//      test then opens the work on :3000 itself.
//   2. This repo: `pnpm next:dev` (:3000, INSTITUTION_SERVER_URL from .env.example).
//   3. `DUCTURA_STOG=1 pnpm test:functional --project=chromium e2e/editor-val1.spec.js`
//
// Everything is opened on `localhost`, never `127.0.0.1`: the session cookie
// (`__Host-ductus_session`) belongs to the host the callback set it on.
// Chromium is the column this was written for; other engines keep Secure
// cookies on http://localhost to differing degrees.
import { test, expect } from '@playwright/test';
import { axe } from './support/axe.js';

const WEB = process.env.DUCTURA_STOG_WEB ?? 'http://localhost:3000';
const OIDC = process.env.DUCTURA_STOG_OIDC ?? 'http://localhost:8090';
const STUDENT = 'demo-student';
const ASSIGNMENT_TITLE = 'Seminarski rad: kućno kompostiranje';

// The texts the page shows (packages/ui save-state.ts, src/lib/i18n/messages.hr.ts).
const SYNCING = 'Sinkroniziram';
const SYNCED = 'Spremljeno na poslužitelju';
const LOCAL = 'Spremljeno na uređaju';
const BLOCKED = 'Dokument je otvoren u drugoj kartici.';

/** Fails at once with what to start, instead of each test timing out. */
async function reachable(url, what) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
  } catch (error) {
    throw new Error(`${what} se ne javlja na ${url} (${error.message}); vidi zaglavlje datoteke.`);
  }
}

/** Signs in as a seed account through the web's /api/v1 and the fake OIDC page. */
async function signIn(page, account) {
  await page.goto(`${WEB}/api/v1/auth/login?returnTo=${encodeURIComponent('/')}`);
  await expect(page).toHaveURL((url) => url.origin === new URL(OIDC).origin);
  await page.locator(`button[name="account"][value="${account}"]`).click();
  // The callback goes to the server's APP_ORIGIN (:4000 or :8000), not to Next.
  await page.waitForURL((url) => url.origin !== new URL(OIDC).origin && !url.pathname.endsWith('/auth/callback'));
  const me = await page.request.get(`${WEB}/api/v1/me`);
  expect(me.status(), 'GET /api/v1/me after sign-in').toBe(200);
}

/** The seed assignment's id, read from student.assignments.get, never hard-coded. */
async function seedAssignmentId(page) {
  const response = await page.request.get(`${WEB}/api/v1/student/assignments`);
  expect(response.status(), 'GET /api/v1/student/assignments').toBe(200);
  const { courses } = await response.json();
  const found = courses.flatMap((course) => course.assignments).find((a) => a.title === ASSIGNMENT_TITLE);
  expect(found, `the seed assignment „${ASSIGNMENT_TITLE}”`).toBeTruthy();
  return found.id;
}

const editorOf = (page) => page.getByRole('textbox', { name: 'Tekst rada' });
const toolbarOf = (page) => page.getByRole('toolbar', { name: 'Oblikovanje teksta' });
// Only the status bar's chip: the editor has other live regions of its own.
const saveChipOf = (page) => page.locator('footer[aria-label="Stanje rada"]').getByRole('status').first();
const tool = (page, name) => toolbarOf(page).getByRole('button', { name, exact: true });

async function openWork(page, id) {
  await page.goto(`${WEB}/rad/${id}`);
  await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
}

/** A line unique to this run and column, so columns sharing the work never match each other's text. */
const line = (what) => `${what} ${test.info().project.name} ${Date.now()}`;

/** Puts the caret at the end of the text and starts a new paragraph with `text`. */
async function writeParagraph(page, text) {
  const editor = editorOf(page);
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(text);
  await expect(editor).toContainText(text);
}

/** Selects the paragraph holding `text` (the caret is in it). */
async function selectParagraph(page, text) {
  await editorOf(page).getByText(text, { exact: true }).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
}

if (process.env.DUCTURA_STOG === '1') {
  test.describe('editor, val 1 (WEB-14, WEB-15) na lokalnom stogu', () => {
    let assignmentId;

    test.beforeAll(async ({ browser }) => {
      await reachable(`${WEB}/`, 'Next (pnpm next:dev)');
      await reachable(`${OIDC}/`, 'Lažni OIDC (pnpm lokalno)');
      await reachable(`${WEB}/api/v1/health`, 'Institution_server kroz /api/v1');
      const page = await browser.newPage();
      await signIn(page, STUDENT);
      assignmentId = await seedAssignmentId(page);
      await page.close();
    });

    test.beforeEach(async ({ page }) => {
      await signIn(page, STUDENT);
    });

    test('WEB-14: piše, sinkronizira, ostaje nakon osvježavanja', async ({ page }) => {
      await openWork(page, assignmentId);
      const text = line('Izmišljeni odlomak o kompostu');
      await writeParagraph(page, text);
      // SYNCING may pass too fast to see; SYNCED is the claim that matters (B-6).
      await expect(saveChipOf(page)).toHaveText(new RegExp(`${SYNCING}|${SYNCED}`));
      await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 20_000 });

      await page.reload();
      await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
      await expect(editorOf(page)).toContainText(text);
      await expect(saveChipOf(page)).toHaveText(SYNCED);
    });

    test('WEB-14: bez mreže sprema na uređaju, s mrežom opet na poslužitelju', async ({ page, context }) => {
      await openWork(page, assignmentId);
      await context.setOffline(true);
      const text = line('Izmišljeni odlomak bez mreže');
      await writeParagraph(page, text);
      await expect(saveChipOf(page)).toHaveText(LOCAL, { timeout: 20_000 });

      await context.setOffline(false);
      await expect(saveChipOf(page)).toHaveText(SYNCED, { timeout: 30_000 });
      await page.reload();
      await expect(editorOf(page)).toContainText(text);
    });

    test('WEB-14: druga kartica je blokirana', async ({ page, context }) => {
      await openWork(page, assignmentId);
      const second = await context.newPage();
      await second.goto(`${WEB}/rad/${assignmentId}`);
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

      for (const [name, element] of [['Podebljano', 'strong'], ['Kurziv', 'em']]) {
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
}
