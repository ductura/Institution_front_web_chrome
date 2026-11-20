import { expect, type Page } from '@playwright/test';

import { oidcOrigin, webOrigin } from './stog';

export async function signInDemoStudent(page: Page) {
  await page.goto('/prijava?returnTo=%2Fzadaci');
  await page.getByRole('link', { name: 'Prijava sustavom AAI@EduHr', exact: true }).click();
  await expect(page).toHaveURL((url) => url.origin === oidcOrigin);
  await page.locator('button[name="account"][value="demo-student"]').click();
  await expect(page).toHaveURL(`${webOrigin}/zadaci`);

  const me = await page.request.get('/api/v1/me');
  await expect(me).toBeOK();
  expect(await me.json()).toMatchObject({ role: 'student' });
}

export async function openDemoWork(page: Page) {
  await page.getByRole('link', { name: /Seminarski rad: kućno kompostiranje/ }).click();
  await expect(page).toHaveURL((url) => url.origin === webOrigin && /^\/rad\/[^/]+$/.test(url.pathname));
  return new URL(page.url()).pathname;
}
