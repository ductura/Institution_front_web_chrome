// F4-STU-R06 (PAR2-A3): the task row reads the same on E-2 and E-3. One deadline tag ("Rok je danas" only on
// today's Zagreb date), the year as "2026./27.", the same text for an expired sign-in, and the main nav named
// "Glavna navigacija". Every person, course and identifier here is invented; the server is faked per test.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const NOW = "2026-11-22T10:00:00Z";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d61";
const TODAY = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e661";
const TOMORROW = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e662";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

async function student(page: Page, assignments: { status: number; json?: unknown }) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) =>
    route.fulfill(assignments.json === undefined ? { status: assignments.status } : { status: assignments.status, json: assignments.json }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({ json: { assignments: [
    { assignmentId: TODAY, workState: "not_started" },
    { assignmentId: TOMORROW, workState: "not_started" },
  ] } }));
  await page.route("**/api/v1/student/assignment-submissions", (route) => route.fulfill({ json: { assignments: [] } }));
  await page.route("**/api/v1/student/assignments/*/deadline-extensions", (route) => route.fulfill({ json: { extensions: [] } }));
}

const COURSES = { courses: [{ id: COURSE, name: "Izmišljeni kolegij medija", academicYear: "2026/2027", assignments: [
  // 21:00 in Zagreb on the 22nd: today.
  { id: TODAY, title: "Esej o izmišljenom gradu", dueAt: "2026-11-22T20:00:00.000Z", noticeFirst: false, workType: "short_paper" },
  // 09:00 in Zagreb on the 23rd: 22 h ahead, but tomorrow.
  { id: TOMORROW, title: "Sažetak izmišljenog članka", dueAt: "2026-11-23T08:00:00.000Z", noticeFirst: false, workType: "essay" },
] }] };

for (const path of ["/app/web/zadaci", "/app/web/zadaci/kolegiji"]) {
  test(`one deadline tag for the same rows on ${path} (PAR2-A3)`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await student(page, { status: 200, json: COURSES });
    await page.goto(path);
    const today = page.getByRole("listitem").filter({ hasText: "Esej o izmišljenom gradu" }).last();
    const tomorrow = page.getByRole("listitem").filter({ hasText: "Sažetak izmišljenog članka" }).last();
    await expect(today.getByText("Rok je danas", { exact: true })).toBeVisible();
    await expect(tomorrow.getByText("Rok za 1 dan", { exact: true })).toBeVisible();
    await expect(tomorrow.getByText("Rok je danas", { exact: true })).toHaveCount(0);
    // The nav is not named like its fifth item.
    await expect(page.getByRole("navigation", { name: "Glavna navigacija" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Radni prostor", exact: true })).toHaveCount(0);
    await axe(page);
  });

  test(`an expired sign-in reads the same on ${path} (PAR2-A3)`, async ({ page }) => {
    await student(page, { status: 401, json: { code: "unauthorized" } });
    await page.goto(path);
    await expect(page.getByRole("status").filter({ hasText: "Prijava nije valjana. Prijavite se ponovno." })).toBeVisible();
    await expect(page.getByText("Prijava sustavom AAI@EduHr", { exact: true })).toBeVisible();
    await axe(page);
  });
}

test("the course card on E-3 writes the year as 2026./27. (PAR2-A3)", async ({ page }) => {
  await student(page, { status: 200, json: COURSES });
  await page.goto("/app/web/zadaci/kolegiji");
  await expect(page.getByText("Kolegij · 2026./27.", { exact: true })).toBeVisible();
  await expect(page.getByText("2026./2027.")).toHaveCount(0);
});
