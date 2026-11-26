// F4-STU-R12 (NF-1 P-14, INVENTAR E-2f, R-49): "Dodaj rokove u kalendar" on the home saves ductura-rokovi.ics
// made in the browser, with the open deadlines only; with every task submitted the button says there is nothing
// to export. No request leaves for the file. Invented people, courses and ids.
import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d41";
const OPEN = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e541";
const STARTED = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e542";
const DONE = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e543";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

async function session(page: Page, assignments: unknown[], states: Array<{ assignmentId: string; workState: string }>) {
  const seen: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/")) seen.push(new URL(request.url()).pathname); });
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({ json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij, medija", assignments }] } }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({ json: { assignments: states } }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ json: { notifications: [], nextBefore: null } }));
  return seen;
}

const task = (id: string, title: string, dueAt: string) => ({ id, title, dueAt, noticeFirst: false });

test("P-14: the open deadlines go to a calendar file made in the browser", async ({ page }) => {
  const seen = await session(page, [
    task(OPEN, "Esej o izmišljenom vrtu", "2099-12-15T22:59:00.000Z"),
    task(STARTED, "Sažetak; drugi dio", "2099-12-20T10:00:00.000Z"),
    task(DONE, "Predani izmišljeni rad", "2099-12-01T22:59:00.000Z"),
  ], [{ assignmentId: STARTED, workState: "in_progress" }, { assignmentId: DONE, workState: "submitted" }]);
  await page.goto("/app/web/zadaci");
  const button = page.getByRole("button", { name: "Dodaj rokove u kalendar" });
  await expect(button).toBeVisible();
  await expect(button).toHaveAccessibleDescription(/nastaje u Vašem pregledniku i ne šalje se poslužitelju/);
  await axe(page);
  const before = seen.length;
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("ductura-rokovi.ics");
  await expect(page.getByRole("status").filter({ hasText: "Datoteka rokova je preuzeta (2)." })).toBeVisible();
  expect(seen.slice(before)).toEqual([]);
  const text = await readFile(await download.path(), "utf8");
  expect(text).toContain("BEGIN:VCALENDAR\r\n");
  expect(text).toContain("DTSTART:20991215T225900Z");
  expect(text).toContain("SUMMARY:Rok: Esej o izmišljenom vrtu (Izmišljeni kolegij\\, medija)");
  expect(text).toContain("SUMMARY:Rok: Sažetak\\; drugi dio (Izmišljeni kolegij\\, medija)");
  expect(text).not.toContain("Predani izmišljeni rad");
  expect(text).not.toContain("Iva");
  await axe(page);
});

test("P-14: with every task submitted the button says there is nothing to export", async ({ page }) => {
  await session(page, [task(DONE, "Predani izmišljeni rad", "2099-12-01T22:59:00.000Z")], [{ assignmentId: DONE, workState: "submitted" }]);
  await page.goto("/app/web/zadaci");
  const button = page.getByRole("button", { name: "Dodaj rokove u kalendar" });
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAccessibleDescription("Nema rokova za izvoz: svi zadaci su predani.");
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  // aria-disabled keeps the button focusable, so Playwright's click would wait for it to be enabled; a keyboard
  // user reaches it and presses Enter, which is what this checks.
  await button.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Nema rokova za izvoz." })).toBeVisible();
  expect(downloaded).toBe(false);
  await axe(page);
});
