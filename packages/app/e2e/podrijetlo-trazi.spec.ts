// ED-34 (P2-9): "/podrijetlo" (group Rad) in the "/" menu opens the work's provenance page, and the toolbar's
// "Traži" opens the same "Traži i zamijeni" row as Ctrl+F. Invented assignment, invented server.
import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c5d";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d3e";
const SCOPE = "c".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0034";
const PATH = `/app/web/rad/${ID}`;

async function openEditor(page: Page) {
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
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  return editor;
}

test("the toolbar's Traži opens the find row and puts the caret in it", async ({ page }) => {
  await openEditor(page);
  const find = page.getByRole("search", { name: "Traži" });
  await expect(find).toHaveCount(0);
  await page.getByRole("button", { name: "Traži", exact: true }).click();
  await expect(find).toBeVisible();
  await expect(find.getByRole("searchbox")).toBeFocused();
});

test("/podrijetlo is offered and opens the work's provenance page", async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type("/podr");
  const option = page.getByRole("option", { name: /\/podrijetlo/ });
  await expect(option).toBeVisible();
  await expect(option).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  // A dev server builds the provenance route on its first visit, so the soft navigation may take a while.
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}/podrijetlo$`), { timeout: 60_000 });
});
