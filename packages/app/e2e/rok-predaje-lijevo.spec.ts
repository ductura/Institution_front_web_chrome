// ED-37 (P2-6): "Rokovi" in the left panel shows the assignment's submission deadline instead of
// "nije dostupan". Invented assignment, invented server.
import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c37";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d37";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0037";
const PATH = `/aplikacija/rad/${ID}`;

async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o gradskim vrtovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
}

test.describe("ED-37 submission deadline in the left panel", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Rokovi shows the deadline of the assignment and the days to it", async ({ page }) => {
    await server(page);
    await page.goto(PATH);
    await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
    await page.getByText("Rokovi", { exact: true }).first().click();
    const due = page.locator("p[data-due]").filter({ hasText: "Rok predaje" });
    await expect(due).toBeVisible();
    await expect(due).toContainText("15. 12. 2099., 23:59 · za ");
    await expect(page.getByText("Rok predaje nije dostupan.")).toHaveCount(0);
  });
});
