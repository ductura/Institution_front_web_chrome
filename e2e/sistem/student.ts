import { expect, test, type Page } from '@playwright/test';

import { app, appBase, oidcOrigin, webOrigin } from './stog';

/** Accounts of the fake AAI@EduHr that have a button on its page (Institution_server seed). */
export type SeedAccount = 'demo-student' | 'demo-student-2' | 'demo-teacher' | 'demo-teacher-2'
  | 'sim:nastavnik:demo-admin@demo.ductus.test';

/**
 * Sign-in as a user enters (INT-10, DAN-887): the Preloader's first screen on
 * `/`, its "Prijava preko AAI@EduHr" (`/api/v1/auth/login?returnTo=/app/web/`),
 * the fake AAI@EduHr, and back on the shipped app under /app/web/, which leads
 * to the role's home page. `pick` chooses the account on the simulator's page.
 */
export async function signInThroughPreloader(page: Page, pick: SeedAccount | ((page: Page) => Promise<void>)) {
  await page.goto('/');
  const signIn = page.getByRole('link', { name: 'Prijava preko AAI@EduHr', exact: true });
  await expect(signIn).toHaveAttribute('href', '/api/v1/auth/login?returnTo=%2Fapp%2Fweb%2F');
  await signIn.click();
  await expect(page).toHaveURL((url) => url.origin === oidcOrigin);
  if (typeof pick === 'function') await pick(page);
  else await page.locator(`button[name="account"][value="${pick}"]`).click();
  await expect(page).toHaveURL((url) => url.origin === webOrigin && url.pathname.startsWith(`${appBase}/`));
}

export async function signInDemoStudent(page: Page, account: 'demo-student' | 'demo-student-2' = 'demo-student') {
  await signInThroughPreloader(page, account);
  await expect(page).toHaveURL(`${webOrigin}${app('/zadaci')}`);

  const me = await page.request.get('/api/v1/me');
  await expect(me).toBeOK();
  expect(await me.json()).toMatchObject({ roles: expect.arrayContaining(['student']) });
}

/** Opens the seed's work from the student's home page; returns its path (/app/web/rad/<id>). */
export async function openDemoWork(page: Page) {
  await page.getByRole('link', { name: /Seminarski rad: kućno kompostiranje/ }).first().click();
  const workPath = new RegExp(`^${appBase}/rad/[^/]+$`);
  await expect(page).toHaveURL((url) => url.origin === webOrigin && workPath.test(url.pathname));
  return new URL(page.url()).pathname;
}

/** The assignment id in a work path from openDemoWork. */
export const assignmentOf = (workPath: string) => workPath.slice(app('/rad/').length);

/**
 * On failure, the page's accessibility tree in the report, so a CI run says
 * what the shipped screen showed without opening the trace.
 */
export function describePageOnFailure() {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const snapshot = await page.locator('body').ariaSnapshot({ timeout: 5_000 }).catch((error) => String(error));
    console.log(`--- ${testInfo.title}: ${page.url()}\n${snapshot}`);
    await testInfo.attach('aria-snapshot', { body: snapshot, contentType: 'text/plain' });
  });
}
