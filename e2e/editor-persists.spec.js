// Funkcionalna provjera: izmjena u editoru ostaje spremljena nakon osvježavanja stranice.
// Stupci matrice dijele isti memorijski API (DAN-755), pa scenarij ne pretpostavlja
// početni sadržaj: očekuje u editoru ono što API trenutačno vraća.
import { test, expect } from '@playwright/test';

test('izmjena ostaje spremljena nakon osvježavanja', async ({ page, request }) => {
  const current = await request.get('/api/documents/demo-1');
  expect(current.ok()).toBe(true);
  const { content } = await current.json();

  await page.goto('/#/doc/demo-1');
  const editor = page.getByLabel('Sadržaj');
  await expect(editor).toHaveValue(content);

  const text = `Izmjena ${test.info().project.name} ${Date.now()}`;
  await editor.fill(text);
  await expect(page.getByRole('status')).toHaveText('Spremljeno');

  await page.reload();
  await expect(page.getByLabel('Sadržaj')).toHaveValue(text);
});
