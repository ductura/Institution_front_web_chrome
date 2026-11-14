// Funkcionalna provjera: izmjena u editoru ostaje spremljena nakon osvježavanja stranice.
import { test, expect } from '@playwright/test';

test('izmjena ostaje spremljena nakon osvježavanja', async ({ page }) => {
  await page.goto('/#/doc/demo-1');
  const editor = page.getByLabel('Sadržaj');
  await expect(editor).toHaveValue('Uvod u temu.');

  const text = `Izmjena ${Date.now()}`;
  await editor.fill(text);
  await expect(page.getByRole('status')).toHaveText('Spremljeno');

  await page.reload();
  await expect(page.getByLabel('Sadržaj')).toHaveValue(text);
});
