// ED-05 (NF2-P20): the "Prvi koraci" guide opens by itself with the first work, focus on its
// heading; only "Završi vodič" or "Preskoči vodič" mark it seen. A guide left open (reload) or
// closed with Esc comes back next time; a student already writing keeps the keyboard. Invented
// assignment, invented server.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c5b";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0e2a";
const SCOPE = "b".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0005";
const PATH = `/app/web/rad/${ID}`;

async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o planinskim stazama", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  // evidence/open: the shared fake answers with the contract's own opened work (fixtures/test).
}

const guide = (page: Page) => page.getByRole("region", { name: "Prvi koraci" });
const editor = (page: Page) => page.locator('.ProseMirror[contenteditable="true"]').first();

async function open(page: Page) {
  await page.goto(PATH);
  await expect(editor(page)).toBeVisible({ timeout: 20_000 });
}

/** The guide stays away: it would have come 700 ms after opening. */
async function staysAway(page: Page) {
  await page.waitForTimeout(2000);
  await expect(guide(page)).toHaveCount(0);
}

test("the first work opens the guide by itself, focus on its heading, 'Oko 2 minute' and three steps", async ({ page }) => {
  await server(page);
  await open(page);
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole("heading", { name: "Prvi koraci" })).toBeFocused();
  await expect(guide(page)).toContainText("Oko 2 minute · Korak 1 od 3");
  await expect(guide(page).getByRole("button", { name: "Natrag" })).toBeDisabled();
  await guide(page).getByRole("button", { name: "Dalje" }).click();
  await expect(guide(page)).toContainText("Korak 2 od 3");
  await guide(page).getByRole("button", { name: "Natrag" }).click();
  await expect(guide(page)).toContainText("Korak 1 od 3");
});

test("left open or closed with Esc, the guide comes back with the next visit", async ({ page }) => {
  await server(page);
  await open(page);
  await expect(guide(page)).toBeVisible();
  await page.reload();
  await expect(editor(page)).toBeVisible({ timeout: 20_000 });
  await expect(guide(page)).toBeVisible();
  await guide(page).getByRole("heading", { name: "Prvi koraci" }).press("Escape");
  await expect(guide(page)).toHaveCount(0);
  await page.reload();
  await expect(editor(page)).toBeVisible({ timeout: 20_000 });
  await expect(guide(page)).toBeVisible();
});

test("'Preskoči vodič' marks it seen: it does not come back by itself", async ({ page }) => {
  await server(page);
  await open(page);
  await guide(page).getByRole("button", { name: "Preskoči vodič" }).click();
  await expect(guide(page)).toHaveCount(0);
  await page.reload();
  await expect(editor(page)).toBeVisible({ timeout: 20_000 });
  await staysAway(page);
});

test("'Završi vodič' marks it seen; Pomoć → Prvi koraci still opens it, focus on its heading", async ({ page }) => {
  await server(page);
  await open(page);
  await guide(page).getByRole("button", { name: "Dalje" }).click();
  await guide(page).getByRole("button", { name: "Dalje" }).click();
  await guide(page).getByRole("button", { name: "Završi vodič" }).click();
  await expect(guide(page)).toHaveCount(0);
  await page.reload();
  await expect(editor(page)).toBeVisible({ timeout: 20_000 });
  await staysAway(page);
  await page.getByRole("button", { name: "Pomoć" }).click();
  await page.getByRole("menuitem", { name: "Prvi koraci" }).click();
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole("heading", { name: "Prvi koraci" })).toBeFocused();
});

test("a student already writing keeps the keyboard when the guide comes", async ({ page }) => {
  await server(page);
  await open(page);
  await editor(page).focus();
  await page.keyboard.press("Control+End");
  await expect(guide(page)).toBeVisible();
  await page.keyboard.type(" Izmišljenapisanje");
  await expect(editor(page)).toContainText("Izmišljenapisanje");
  expect(await page.evaluate(() => !!document.activeElement?.closest(".ProseMirror"))).toBe(true);
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`a11y: ${width} px, ${theme}: the guide passes axe, no overflow, focus visible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setTheme(page, theme);
      await server(page);
      await open(page);
      await expect(guide(page)).toBeVisible();
      await axe(page, test.info(), `prvi koraci ${width} ${theme}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      await page.keyboard.press("Tab");
      await expect(guide(page).getByRole("button", { name: "Dalje" })).toBeFocused();
      expect(await hiddenFocus(page)).toEqual([]);
    });
  }
}
