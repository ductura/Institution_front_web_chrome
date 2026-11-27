import { expect, test } from '@playwright/test';

import { app, webOrigin } from './stog';
import { describePageOnFailure, openDemoWork, signInDemoStudent } from './student';

// WEB-NASLOVI-SVE: the tab's title ("<naslov>, Ductura") and the navigation's aria-current on the
// student's key routes. The title uses a comma, not a dot (Ductus#2059 c.7214951129, A4).

describePageOnFailure();

test('naslovi kartica i aria-current na ključnim rutama studenta', async ({ page }) => {
  await signInDemoStudent(page);
  const current = page.getByRole('navigation', { name: 'Glavna navigacija' }).locator('[aria-current="page"]');

  await expect(page).toHaveTitle('Moji zadaci, Ductura');
  await expect(current).toHaveText('Moji zadaci');

  await page.goto(app('/zadaci/radovi'));
  await expect(page).toHaveTitle('Moji radovi, Ductura');
  await expect(current).toHaveText('Moji radovi');

  const workPath = await openDemoWork(page);
  await expect(page).toHaveTitle(/ — Pisanje, Ductura$/);

  await page.goto(`${webOrigin}${workPath}/predaja/izjava`);
  await expect(page).toHaveTitle(/ — Predaja, Ductura$/);

  await page.goto('/');
  await expect(page).toHaveTitle('Ductura');
});
