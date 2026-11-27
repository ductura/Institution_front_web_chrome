// ED-71: Prikaz, "Sadržaj na listu" puts the table of contents on the sheet above the text and takes it off
// again; "Prvi redovi" opens the right panel's Pregled on its Nacrt. Both are local: nothing is sent.
// Invented assignment, invented server.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ID = "4d5e6f7a-8b9c-4dad-9e1f-2a3b4c5d6e71";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d71";
const PATH = `/aplikacija/rad/${ID}`;

async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: "e".repeat(64), sessionTag: "izmisljena-oznaka-prijave-ed71" },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o starim mlinovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
}

test.use({ viewport: { width: 1280, height: 900 } });

test("ED-71: Sadržaj na listu shows and hides the contents on the sheet, Prvi redovi opens Nacrt", async ({ page }) => {
  await server(page);
  const sent: string[] = [];
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  page.on("request", (request) => { if (request.method() !== "GET" && request.url().includes("/api/")) sent.push(new URL(request.url()).pathname); });

  const box = page.getByRole("navigation", { name: "Sadržaj na listu" });
  await expect(box).toHaveCount(0);
  await page.getByRole("button", { name: "Prikaz ▾" }).click();
  await page.getByRole("menuitem", { name: "Sadržaj na listu" }).click();
  await expect(box).toBeVisible();
  await expect(box.getByRole("heading", { name: "Sadržaj" })).toBeVisible();
  await expect(box).toContainText("Složeno iz naslova.");

  const results = await new AxeBuilder({ page }).include('[data-sheet-toc]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Prikaz ▾" }).click();
  await page.getByRole("menuitem", { name: "✓ Sadržaj na listu" }).click();
  await expect(box).toHaveCount(0);

  await page.getByRole("button", { name: "Prikaz ▾" }).click();
  await page.getByRole("menuitem", { name: "Prvi redovi" }).click();
  await expect(page.getByRole("button", { name: "Nacrt", pressed: true })).toBeVisible();
  expect(sent.filter((path) => !path.includes("/evidence/"))).toEqual([]);
});
