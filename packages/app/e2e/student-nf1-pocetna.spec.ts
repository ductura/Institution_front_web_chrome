// WEB-NF1-POCETNA (NF-1 P-2, P-4, P-12): the reminder in the bell names its assignment,
// the home page continues the nearest started work and lists by deadline, and a student
// with several courses and no task sees all of them. Invented people, courses and ids.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const COURSE_A = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d31";
const COURSE_B = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d32";
const FAR = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e531";
const NEAR = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e532";
const LATER = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e533";
const DONE = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e534";
const REMINDER = "00000000-0000-4000-8000-00000000f201";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

async function session(page: Page, courses: unknown[], states: Array<{ assignmentId: string; workState: string }> = [], notifications: unknown[] = []) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({ json: { courses } }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({ json: { assignments: states } }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ json: { notifications, nextBefore: null } }));
}

const task = (id: string, title: string, dueAt: string) => ({ id, title, dueAt, noticeFirst: false });
const NEAR_DUE = new Date(Date.now() + 3 * 86_400_000).toISOString();
const FAR_DUE = new Date(Date.now() + 60 * 86_400_000).toISOString();
const LATER_DUE = new Date(Date.now() + 90 * 86_400_000).toISOString();

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`P-4: continues the nearest started work and lists by deadline (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await session(page, [{ id: COURSE_A, name: "Izmišljeni kolegij medija", assignments: [
        task(FAR, "Esej o dalekom roku", FAR_DUE), task(NEAR, "Sažetak o bliskom roku", NEAR_DUE),
        task(LATER, "Završni izmišljeni rad", LATER_DUE), task(DONE, "Predani izmišljeni rad", NEAR_DUE),
      ] }], [
        { assignmentId: FAR, workState: "in_progress" }, { assignmentId: NEAR, workState: "in_progress" },
        { assignmentId: DONE, workState: "submitted" },
      ]);
      await page.goto("/aplikacija/zadaci");
      const next = page.getByRole("region", { name: "Sažetak o bliskom roku" });
      await expect(next).toBeVisible();
      await expect(page.getByRole("region", { name: "Esej o dalekom roku" })).toHaveCount(0);
      // Sections: Uskoro (nearest first), Kasnije, and the submitted work at the bottom.
      const tasks = page.getByRole("region", { name: "Moji zadaci" });
      await expect(tasks.getByRole("heading", { level: 3 })).toHaveText(["Uskoro", "Kasnije", "Predano"]);
      await expect(tasks.getByRole("listitem").first()).toContainText("Sažetak o bliskom roku");
      await page.getByLabel("Poredak").selectOption("kolegij");
      await expect(tasks.getByRole("heading", { level: 3 })).toHaveCount(0);
      await expect(tasks.getByRole("listitem").first()).toContainText("Esej o dalekom roku");
      await axe(page);
    });
  }
}

test("P-12: with several courses and no task, every course is shown with the code card", async ({ page }) => {
  await session(page, [
    { id: COURSE_A, name: "Izmišljeni kolegij A", assignments: [] },
    { id: COURSE_B, name: "Izmišljeni kolegij B", assignments: [] },
  ]);
  await page.goto("/aplikacija/zadaci");
  await expect(page.getByRole("heading", { name: "Izmišljeni kolegij A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Izmišljeni kolegij B" })).toBeVisible();
  await expect(page.getByText("U ovom kolegiju zasad nema zadatka.")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Upiši" })).toBeVisible();
  await axe(page);
});

test("P-2: a reminder in the bell names the assignment and its deadline; an unknown assignment keeps the plain line", async ({ page }) => {
  await session(page, [{ id: COURSE_A, name: "Izmišljeni kolegij medija", assignments: [task(NEAR, "Sažetak o bliskom roku", "2099-12-15T22:59:00.000Z")] }], [], [
    { id: REMINDER, kind: "deadline_reminder", targetId: NEAR, createdAt: "2026-11-20T08:00:00.000Z", readAt: null },
    { id: "00000000-0000-4000-8000-00000000f202", kind: "deadline_reminder", targetId: FAR, createdAt: "2026-11-20T07:00:00.000Z", readAt: null },
  ]);
  await page.goto("/aplikacija/zadaci");
  await page.getByRole("button", { name: "Obavijesti, nepročitanih: 2" }).click();
  const list = page.getByRole("dialog", { name: "Popis obavijesti" });
  await expect(list.getByRole("link", { name: /Rok za zadatak Sažetak o bliskom roku: 15\. 12\. 2099\./ })).toHaveAttribute("href", `/aplikacija/zadatak/${NEAR}`);
  await expect(list.getByRole("link", { name: /Podsjetnik na rok zadatka/ })).toBeVisible();
  await axe(page);
});
