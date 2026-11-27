// STU-R07 / P-13: below 800 px the bell and "Odjava" are in the top bar without opening "Izbornik"; one button per E-2 row.
import { expect, test } from "./fixtures/test";

const ID = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e5f7";

test("at 390 px the bell and Odjava are visible with the menu closed, and a row has one button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } } }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1f", name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "not_started" }] },
  }));
  await page.goto("/app/web/zadaci");
  const menu = page.getByRole("button", { name: "Izbornik" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: /^Obavijesti/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odjava" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kako Ductura radi" })).toBeHidden();
  const row = page.getByRole("listitem").filter({ hasText: "Izmišljeni seminar" });
  await expect(row.getByRole("link")).toHaveCount(1);
  await expect(row.getByRole("button")).toHaveCount(0);
});
