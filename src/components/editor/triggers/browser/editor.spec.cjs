const { test, expect } = require('@playwright/test');
const { default: AxeBuilder } = require('@axe-core/playwright');

const openHelp = async (page, title) => {
  await page.getByRole('button', { name: 'Pomoć', exact: true }).click();
  await page.getByRole('menuitem', { name: title, exact: true }).click();
};

for (const [width, theme] of [[1250, 'dark'], [1050, 'light'], [760, 'dark'], [640, 'light']]) {
  test(`help and trigger popovers at ${width}px in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await page.locator('html').evaluate((el, value) => { el.dataset.theme = value; }, theme);
    const scan = async () => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const help = page.getByRole('button', { name: 'Pomoć', exact: true });
    await openHelp(page, 'Pomoć u tekstu');
    await page.getByRole('button', { name: 'Mirno', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Duge rečenice' })).not.toBeChecked();
    await scan();
    await page.keyboard.press('Escape');
    await expect(help).toBeFocused();
    await page.reload();
    await page.locator('html').evaluate((el, value) => { el.dataset.theme = value; }, theme);
    await openHelp(page, 'Pomoć u tekstu');
    await expect(page.getByRole('button', { name: 'Mirno', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await openHelp(page, 'Prvi koraci');
    const guide = page.getByRole('region', { name: 'Prvi koraci' });
    await expect(guide.getByRole('heading', { name: 'Prvi koraci' })).toBeFocused();
    await expect(guide.getByText(/Korak 1 od 3/)).toBeVisible();
    await scan();
    await guide.getByRole('button', { name: 'Dalje' }).click();
    await guide.getByRole('button', { name: 'Dalje' }).click();
    await guide.getByRole('button', { name: 'Završi vodič' }).click();
    await expect(guide).toHaveCount(0);
    await expect(help).toBeFocused();
    for (const title of ['Prije prve rečenice', 'Što se bilježi']) {
      await openHelp(page, title);
      await expect(page.getByRole('dialog', { name: title })).toBeVisible();
      await scan();
      await page.keyboard.press('Escape');
    }
    const sheet = page.getByRole('textbox', { name: 'Tekst rada' });
    await expect(page.getByRole('status')).toHaveText(/Bez mreže/);
    await expect(page.getByRole('status')).not.toHaveText(/sprema se/);
    await scan();
    await page.getByRole('button', { name: 'Nastavi pisati' }).click();
    await expect(page.getByRole('button', { name: 'Nastavi pisati' })).toHaveCount(0);
    await sheet.click();
    await page.keyboard.insertText('@ča');
    await expect(page.getByRole('option', { name: 'Čavlović (2026) Izmišljena literatura' })).toBeVisible();
    await scan();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { selected: true })).toContainText('str. 14');
    await page.keyboard.press('Tab');
    await expect(sheet).toHaveText('(Čavlović, 2026, 14)');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('/pog');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(sheet).toBeFocused();
    await page.keyboard.insertText('l');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('/pog');
    await page.getByRole('option', { name: /\/poglavlje/ }).click();
    await expect(sheet.locator('h2')).toHaveCount(1);
    await page.keyboard.insertText('/nav');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Umetni navod' })).toBeVisible();
    await page.getByRole('option', { name: 'Čavlović (2026) Izmišljena literatura' }).click();
    await expect(sheet.locator('h2')).toHaveText('(Čavlović, 2026)');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('@');
    await expect(page.getByRole('dialog', { name: 'Izvori' })).toBeVisible();
    await page.getByRole('button', { name: 'Promijeni uređivanje' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(sheet).toHaveAttribute('contenteditable', 'false');
  });
}

test('first visit is scoped to the account and saving works while the guide is open', async ({ page }) => {
  let account = 'a'.repeat(64);
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: {
    journalScope: account, sessionTag: 'demo-session-tag',
  } }));
  await page.setViewportSize({ width: 400, height: 740 });
  await page.goto('/');
  const guide = page.getByRole('region', { name: 'Prvi koraci' });
  const help = page.getByRole('button', { name: 'Pomoć', exact: true });
  await expect(guide).toBeVisible();
  await page.getByRole('button', { name: 'Spremi', exact: true }).click();
  await expect(page.getByText('Izmišljeni rad je spremljen.')).toBeVisible();
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Preskoči vodič' }).click();
  await expect(guide).toHaveCount(0);
  await expect(help).toBeFocused();

  await Promise.all([page.waitForResponse('**/api/v1/me'), page.reload()]);
  await expect(guide).toHaveCount(0);
  await openHelp(page, 'Prvi koraci');
  await guide.getByRole('button', { name: 'Dalje' }).press('Enter');
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Korak 2 od 3' })).toContainText('Navodi i naredbe');
  await page.keyboard.press('Escape');
  await expect(guide).toHaveCount(0);
  await expect(help).toBeFocused();

  account = 'b'.repeat(64);
  await page.reload();
  await expect(guide).toBeVisible();
  await page.locator('html').evaluate((element) => { element.lang = 'en-GB'; });
  const english = page.getByRole('region', { name: 'Getting started' });
  await expect(english).toHaveAttribute('lang', 'en');
  await expect(english.getByText(/About 2 minutes.*Step 1 of 3/)).toBeVisible();
  await english.getByRole('button', { name: 'Skip guide' }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Getting started' }).click();
  await expect(english).toBeVisible();
});

test('current-page settings still work with storage blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('blocked', 'SecurityError'); } }));
  await page.goto('/');
  await openHelp(page, 'Pomoć u tekstu');
  await page.getByRole('button', { name: 'Sve', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Duge rečenice' })).toBeChecked();
  await page.keyboard.press('Escape');
  await openHelp(page, 'Pomoć u tekstu');
  await expect(page.getByRole('button', { name: 'Sve', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
