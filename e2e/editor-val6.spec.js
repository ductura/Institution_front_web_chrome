// WEB-6G: PLAN-MIGRACIJE.md, Val 6, “Što Daniel klikne” 1–4.
// Start the seeded Institution_server stack and pnpm next:dev as for editor-val1.
// With DUCTURA_STOG=1, run pnpm test:functional --project=chromium e2e/editor-val6.spec.js.
import { expect, test as base } from '@playwright/test';
import { axe } from './support/axe.js';

const WEB = process.env.DUCTURA_STOG_WEB ?? 'http://localhost:3000';
const OIDC = process.env.DUCTURA_STOG_OIDC ?? 'http://localhost:8090';
const TITLE = 'Seminarski rad: kućno kompostiranje';
const RAIL = 'Struktura rada';
const PANEL = 'Bočni panel';
const HEIGHT = 900;

const editorOf = (page) => page.getByRole('textbox', { name: 'Tekst rada', exact: true });
const sheetOf = (page) => page.getByRole('article', { name: 'Tekst rada', exact: true });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const dialog = (page, name) => page.getByRole('dialog', { name, exact: true });

const test = base.extend({
  workUrl: async ({ page }, use) => {
    // Local fixture account from the server seed. The callback may land on :4000 or :8000.
    await page.goto(`${WEB}/api/v1/auth/login?returnTo=%2F`);
    await expect(page).toHaveURL((url) => url.origin === new URL(OIDC).origin);
    await page.locator('button[name="account"][value="demo-student"]').click();
    await page.waitForURL((url) => url.origin !== new URL(OIDC).origin && !url.pathname.endsWith('/auth/callback'));
    const response = await page.request.get(`${WEB}/api/v1/student/assignments`);
    expect(response.status(), 'GET /api/v1/student/assignments').toBe(200);
    const { courses } = await response.json();
    const assignment = courses.flatMap(({ assignments }) => assignments).find(({ title }) => title === TITLE);
    expect(assignment, `Zadatak iz seeda: ${TITLE}`).toBeTruthy();
    await use(`${WEB}/rad/${encodeURIComponent(assignment.id)}`);
  },
});

async function openWork(page, url) {
  await page.goto(url);
  await expect(editorOf(page)).toHaveAttribute('aria-readonly', 'false');
}

async function openDrawer(page, name) {
  await button(page, name).click();
  const drawer = dialog(page, name);
  await expect(drawer).toBeVisible();
  return drawer;
}

async function selectLayout(page, panel, name, layout) {
  await button(panel, name).click();
  const settings = dialog(page, name);
  const option = settings.getByRole('group', { name: 'Raspored', exact: true })
    .getByRole('button', { name: layout });
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  await button(settings, 'Gotovo').click();
  await expect(settings).toBeHidden();
}

async function selectSheetTheme(page, name) {
  await button(page.getByRole('toolbar', { name: 'Oblikovanje teksta' }), 'Prikaz').click();
  await page.getByRole('menu', { name: 'Prikaz', exact: true })
    .getByRole('menuitemradio', { name, exact: true }).click();
}

if (process.env.DUCTURA_STOG === '1') {
  test.describe('editor, val 6 na lokalnom stogu', () => {
    for (const width of [1250, 1050, 760, 640]) {
      test(`1–2. Ljuska, ladice i axe na ${width} px`, async ({ page, workUrl }) => {
        await page.setViewportSize({ width, height: HEIGHT });
        await openWork(page, workUrl);
        const sheet = sheetOf(page);
        const stage = page.getByRole('main');
        const header = page.locator('[data-editor-chrome]').filter({ has: button(page, RAIL) });
        const tools = page.locator('[data-editor-chrome]').filter({
          has: page.getByRole('toolbar', { name: 'Oblikovanje teksta' }),
        });
        await expect(header).toHaveCSS('height', '48px');
        await expect(tools).toHaveCSS('height', width === 640 ? '50px' : '44px');
        await expect(stage).toHaveCSS('padding-left', width === 640 ? '0px' : '24px');
        await expect(sheet).toHaveCSS('max-width', '820px');
        await expect(sheet).toHaveCSS('padding-left', width === 640 ? '20px' : '50px');
        const status = page.locator('footer[aria-label="Stanje rada"]').locator('..');
        await expect(status).toBeInViewport();
        await expect(status).toHaveCSS('min-height', width === 640 ? '34px' : '30px');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

        const pinnedPanel = page.getByRole('complementary', { name: PANEL, exact: true });
        await expect(button(page, RAIL)).toHaveAttribute('aria-expanded', 'false');
        await expect(dialog(page, RAIL)).toBeHidden();
        if (width === 1250) {
          await expect(pinnedPanel).toHaveCSS('width', '340px');
          await expect(button(page, PANEL)).toBeHidden();
        } else {
          await expect(pinnedPanel).toBeHidden();
          await expect(button(page, PANEL)).toHaveAttribute('aria-expanded', 'false');
        }
        await axe(page);

        const rail = await openDrawer(page, RAIL);
        await expect(rail).toHaveCSS('position', 'fixed');
        await expect(rail).toHaveCSS('width', '320px');
        await expect(rail.getByText(width === 640 ? 'Dvije razine' : 'Popis', { exact: true })).toBeVisible();
        await axe(page);
        await page.keyboard.press('Escape');
        await expect(rail).toBeHidden();
        await expect(button(page, RAIL)).toBeFocused();

        if (width <= 1050) {
          const panel = await openDrawer(page, PANEL);
          await expect(panel).toHaveCSS('width', '380px');
          await expect(panel.getByRole('tab', { name: 'Izvori', exact: true })).toHaveAttribute('aria-selected', 'true');
          await axe(page);
          // Click the part of the backdrop outside the right drawer.
          await page.mouse.click(12, HEIGHT / 2);
          await expect(panel).toBeHidden();
          await expect(button(page, PANEL)).toBeFocused();
        }
      });
    }

    test('2. Rasporedi A/B/C, lokalni odabir i donja ladica C', async ({ page, workUrl }) => {
      await page.setViewportSize({ width: 1440, height: HEIGHT });
      await openWork(page, workUrl);
      const left = page.getByRole('complementary', { name: RAIL, exact: true });
      const right = page.getByRole('complementary', { name: PANEL, exact: true });
      await expect(left).toHaveCSS('width', '288px');
      await expect(left.getByText('Popis', { exact: true })).toBeVisible();
      await expect(right.getByRole('tab', { name: 'Izvori', exact: true })).toBeVisible();

      await selectLayout(page, left, 'Prilagodi panel', /^Kartice/);
      await expect(left.getByRole('tab', { name: 'Struktura', exact: true })).toBeVisible();
      await selectLayout(page, left, 'Prilagodi panel', /^Dvije razine/);
      await expect(left.getByText('Dvije razine', { exact: true })).toBeVisible();
      await expect(left.getByRole('tablist')).toBeHidden();

      await selectLayout(page, right, 'Prilagodi desni panel', /^Uz tekst/);
      await expect(right.getByRole('heading', { name: 'Komentari ovdje', exact: true })).toBeVisible();
      await selectLayout(page, right, 'Prilagodi desni panel', /^Ikone uz rub/);
      await button(right, 'Komentari').click();
      await expect(button(right, 'Komentari')).toHaveAttribute('aria-pressed', 'true');
      await expect(right.getByRole('heading', { name: 'Komentari', exact: true })).toBeVisible();

      await openWork(page, workUrl);
      await expect(left.getByText('Dvije razine', { exact: true })).toBeVisible();
      await expect(button(right, 'Komentari')).toBeVisible();
      await page.setViewportSize({ width: 1050, height: HEIGHT });
      const bottom = await openDrawer(page, PANEL);
      await expect(bottom).toHaveCSS('height', `${HEIGHT * 0.76}px`);
      await expect.poll(async () => (await bottom.boundingBox())?.y).toBeCloseTo(HEIGHT * 0.24, 0);
      await axe(page);
      await page.keyboard.press('Escape');
      await expect(bottom).toBeHidden();
    });

    test('2. Način fokusa i traženje u tekstu', async ({ page, workUrl }) => {
      await page.setViewportSize({ width: 1440, height: HEIGHT });
      await openWork(page, workUrl);
      const editor = editorOf(page);
      const enter = button(page, 'Način fokusa');
      const exit = button(page, 'Izađi iz načina fokusa');
      await enter.click();
      await expect(exit).toBeFocused();
      await expect(sheetOf(page)).toBeVisible();
      await expect(page.getByRole('toolbar', { name: 'Oblikovanje teksta' })).toBeHidden();
      await expect(page.getByRole('complementary', { name: RAIL, exact: true })).toBeHidden();
      await expect(page.getByRole('complementary', { name: PANEL, exact: true })).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(enter).toBeFocused();

      // Use a unique term so earlier runs on the same synthetic assignment cannot match it.
      const term = `kompostiranje${Date.now()}`;
      await editor.press('Control+End');
      await editor.press('Enter');
      await page.keyboard.insertText(`${term} i ${term}`);
      await expect(editor).toContainText(term);
      await page.keyboard.press('Control+f');
      const search = page.getByRole('searchbox', { name: 'Traži…', exact: true });
      await expect(search).toBeFocused();
      await search.fill(term);
      await expect(page.getByText('1 od 2', { exact: true })).toBeVisible();
      await search.press('Enter');
      await expect(page.getByText('2 od 2', { exact: true })).toBeVisible();
      await search.press('Escape');
      await expect(search).toBeHidden();
      await expect(editor).toBeFocused();
      await editor.press('Control+z');
      await expect(editor).not.toContainText(term);
    });

    test('3. Naredbe, prečaci i kontekstni izbornik mišem i tipkovnicom', async ({ page, workUrl }) => {
      await page.setViewportSize({ width: 640, height: HEIGHT });
      await openWork(page, workUrl);
      const editor = editorOf(page);
      const palette = dialog(page, 'Naredbe');
      const shortcuts = dialog(page, 'Prečaci');
      const context = page.getByRole('menu', { name: 'Izbornik teksta', exact: true });
      await editor.press('Control+k');
      const query = palette.getByRole('combobox');
      await expect(query).toBeFocused();
      await query.fill('Prečaci');
      await expect(palette.getByRole('option', { name: /^Prečaci/, selected: true })).toBeVisible();
      await query.press('Enter');
      await expect(palette).toBeHidden();
      await expect(shortcuts).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(shortcuts).toBeHidden();

      await editor.press('Control+/');
      await expect(shortcuts.getByText('Shift+F10', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(shortcuts).toBeHidden();
      await expect(editor).toBeFocused();

      await editor.press('Shift+F10');
      const item = context.getByRole('menuitem', { name: /^Posebni znak/ });
      await expect(item).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(context).toBeHidden();
      await expect(editor).toBeFocused();
      await editor.click({ button: 'right' });
      await expect(item).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(context).toBeHidden();
    });

    test('4. Tema lista mijenja se neovisno o ljusci i ostaje nakon osvježavanja', async ({ page, workUrl }) => {
      await page.setViewportSize({ width: 1250, height: HEIGHT });
      await openWork(page, workUrl);
      const root = page.locator('html');
      const sheet = sheetOf(page);
      await expect(root).toHaveAttribute('data-theme', 'dark');
      await expect(sheet).toHaveAttribute('data-sheet-theme', 'light');
      const paper = await sheet.evaluate((element) => getComputedStyle(element).backgroundColor);
      await selectSheetTheme(page, 'Tamni list');
      await expect(sheet).toHaveAttribute('data-sheet-theme', 'dark');
      await expect(sheet).not.toHaveCSS('background-color', paper);
      await expect(root).toHaveAttribute('data-theme', 'dark');
      await page.reload();
      await expect(sheet).toHaveAttribute('data-sheet-theme', 'dark');

      await page.goto(`${WEB}/zadaci`);
      await button(page, 'Promijeni svijetlu ili tamnu temu').click();
      await expect(root).toHaveAttribute('data-theme', 'light');
      await openWork(page, workUrl);
      await expect(root).toHaveAttribute('data-theme', 'light');
      await expect(sheet).toHaveAttribute('data-sheet-theme', 'dark');
      await selectSheetTheme(page, 'Bijeli list');
      await expect(sheet).toHaveCSS('background-color', paper);
      await page.reload();
      await expect(root).toHaveAttribute('data-theme', 'light');
      await expect(sheet).toHaveAttribute('data-sheet-theme', 'light');
    });
  });
}
