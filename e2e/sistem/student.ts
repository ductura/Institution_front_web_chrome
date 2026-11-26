import { expect, test, type Page } from '@playwright/test';

import { app, appBase, oidcOrigin, webOrigin } from './stog';

/** Accounts of the fake AAI@EduHr that have a button on its page (Institution_server seed). */
export type SeedAccount = 'demo-student' | 'demo-student-2' | 'demo-teacher' | 'demo-teacher-2'
  | 'sim:nastavnik:demo-admin@demo.ductus.test';

/**
 * Sign-in as a user enters (INT-10, DAN-887): the Preloader's first screen on
 * `/ulaz` (D-318), its link to the app's sign-in screen `/aplikacija/prijava`, which goes to
 * `/api/v1/auth/login?returnTo=/aplikacija/`, the fake AAI@EduHr, and back on the shipped app under /aplikacija/, which leads
 * to the role's home page. `pick` chooses the account on the simulator's page.
 */
export async function signInThroughPreloader(page: Page, pick: SeedAccount | ((page: Page) => Promise<void>)) {
  await page.goto('/ulaz');
  const open = page.locator('a#open-app');
  await expect(open).toHaveAttribute('href', `${appBase}/prijava`);
  await open.click();
  // The app's sign-in screen leaves for the login of the institution server, which returns to /aplikacija/.
  await expect(page).toHaveURL((url) => url.origin === oidcOrigin, { timeout: 30_000 });
  if (typeof pick === 'function') await pick(page);
  else await page.locator(`button[name="account"][value="${pick}"]`).click();
  // The first sign-in of a run is the first request the shipped app answers, and on a
  // cold local stack that can take longer than the default 5 s (INT-20, F3b 24. 11.).
  await expect(page).toHaveURL((url) => url.origin === webOrigin && url.pathname.startsWith(`${appBase}/`), { timeout: 30_000 });
}

export async function signInDemoStudent(page: Page, account: 'demo-student' | 'demo-student-2' = 'demo-student') {
  await signInThroughPreloader(page, account);
  await expect(page).toHaveURL(`${webOrigin}${app('/zadaci')}`);

  const me = await page.request.get('/api/v1/me');
  await expect(me).toBeOK();
  expect(await me.json()).toMatchObject({ roles: expect.arrayContaining(['student']) });
}

/** Opens the seed's work from the student's home page; returns its path (/aplikacija/rad/<id>). */
export async function openDemoWork(page: Page) {
  await page.getByRole('link', { name: /Seminarski rad: kućno kompostiranje/ }).first().click();
  const workPath = new RegExp(`^${appBase}/rad/[^/]+$`);
  await expect(page).toHaveURL((url) => url.origin === webOrigin && workPath.test(url.pathname));
  return new URL(page.url()).pathname;
}

/**
 * The editor's first-run guide ("Prvi koraci") covers the sheet's top bar
 * until it is closed; a student closes it with "Preskoči vodič".
 */
export async function dismissGuide(page: Page) {
  const skip = page.getByRole('button', { name: 'Preskoči vodič', exact: true });
  if (await skip.isVisible()) await skip.click();
}

/**
 * The seed's assignment as the home page links it: to the work while it is
 * written, to the receipt once it is submitted (/aplikacija/rad/<id>/predaja/potvrda).
 */
export async function openDemoAssignment(page: Page) {
  await page.getByRole('link', { name: /Seminarski rad: kućno kompostiranje/ }).first().click();
  const under = new RegExp(`^${appBase}/rad/([^/]+)(?:/|$)`);
  await expect(page).toHaveURL((url) => url.origin === webOrigin && under.test(url.pathname));
  return { assignmentId: new URL(page.url()).pathname.match(under)![1]!, path: new URL(page.url()).pathname };
}

/** The assignment id in a work path from openDemoWork. */
export const assignmentOf = (workPath: string) => workPath.slice(app('/rad/').length);

/**
 * On failure, the page's accessibility tree in the report, so a CI run says
 * what the shipped screen showed without opening the trace.
 */
export function describePageOnFailure() {
  test.afterEach(async ({ browser }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    // Every open page of every context: a test may work in a context of its own.
    for (const [index, open] of browser.contexts().flatMap((context) => context.pages()).entries()) {
      const snapshot = await open.locator('body').ariaSnapshot({ timeout: 5_000 }).catch((error) => String(error));
      console.log(`--- ${testInfo.title} [${index}]: ${open.url()}\n${snapshot}`);
      await testInfo.attach(`aria-snapshot-${index}`, { body: snapshot, contentType: 'text/plain' });
    }
  });
}

/**
 * INT-14 (A08): the start of a paragraph the student writes after V1 is confirmed, while the
 * server's answer never arrives. Neither the submission nor the teacher may show it.
 */
export const UNCONFIRMED_V2 = 'Lokalna verzija V2 koju poslužitelj nije potvrdio';

/** True when a journal database of this origin holds `needle` in a stored snapshot (A05). */
export function journalHolds(page: Page, needle: string) {
  return page.evaluate(async (needle) => {
    const decoder = new TextDecoder();
    const holds = (value: unknown, depth = 0): boolean => {
      if (depth > 64 || value === null || value === undefined) return false;
      if (typeof value === 'string') return value.includes(needle);
      if (value instanceof ArrayBuffer) return decoder.decode(value).includes(needle);
      if (ArrayBuffer.isView(value)) return decoder.decode(value).includes(needle);
      if (typeof value === 'object') return Object.values(value).some((entry) => holds(entry, depth + 1));
      return false;
    };
    const names = (await indexedDB.databases()).map(({ name }) => name ?? '').filter((name) => name.startsWith('ductus-journal-v1-'));
    for (const name of names) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        if (!db.objectStoreNames.contains('snapshots')) continue;
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const request = db.transaction('snapshots').objectStore('snapshots').getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (rows.some((row) => holds(row))) return true;
      } finally {
        db.close();
      }
    }
    return false;
  }, needle);
}
