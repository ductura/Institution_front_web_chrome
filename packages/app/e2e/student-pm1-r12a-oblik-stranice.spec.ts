// F4-PM1-R12A (PM1-93, PM2-45): the student's editor shows the page format from the faculty rules under Prikaz,
// "Oblik stranice". It is read only: nothing to type into, nothing sent. Invented assignment, invented server.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ID = "4d5e6f7a-8b9c-4dad-9e1f-2a3b4c5d6e72";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d72";
const PATH = `/aplikacija/rad/${ID}`;

async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: "d".repeat(64), sessionTag: "izmisljena-oznaka-prijave-r12a" },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o riječnim lukama", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
}

test.use({ viewport: { width: 1280, height: 900 } });

test("PM1-R12A: Prikaz opens the read-only page format, which closes again and passes axe", async ({ page }) => {
  await server(page);
  const sent: string[] = [];
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  page.on("request", (request) => { if (request.method() !== "GET" && request.url().includes("/api/")) sent.push(new URL(request.url()).pathname); });

  await page.getByRole("button", { name: "Prikaz ▾" }).click();
  await page.getByRole("menuitem", { name: "Oblik stranice" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Oblik stranice" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Pismo");
  await expect(dialog).toContainText("Margine");
  await expect(dialog).toContainText("Brojevi stranica");
  await expect(dialog).toContainText("Točan prijelom daje izvoz.");
  await expect(dialog.locator("input, textarea, select")).toHaveCount(0);

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);

  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await expect(dialog).toHaveCount(0);
  expect(sent.filter((path) => !path.includes("/evidence/"))).toEqual([]);
});
