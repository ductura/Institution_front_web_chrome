// ED-36 (paritet-editor-2 PRIJEDLOG #5, C-02/C-03/C-05): the chapter panel shows the writing help of the
// chapter under the cursor: its role, "Što ovdje ide", and the review that marks it "gotovo".
// Invented assignment, invented server.
import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c36";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d36";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0036";
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

test.describe("ED-36 writing help of a chapter", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a new chapter gets its role and advice, and the review marks it gotovo", async ({ page }) => {
    await server(page);
    await page.goto(PATH);
    const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.focus();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Uvod");
    await page.keyboard.press("Control+Alt+2");
    await expect(editor.locator("h2", { hasText: "Uvod" })).toBeVisible();

    const help = page.locator("[data-chapter-help]");
    await expect(help).toBeVisible();
    await expect(help.getByLabel("Uloga poglavlja")).toHaveValue("uvod");
    await expect(help.getByText("Što ovdje ide")).toBeVisible();

    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Izmišljeni gradski vrtovi rastu u svakom kvartu.");
    await help.getByRole("button", { name: "Pregledaj poglavlje" }).click();
    const review = page.getByRole("dialog", { name: "Pregled poglavlja" });
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Ipak označi gotovo" }).click();
    await expect(review).toBeHidden();
    await expect(page.getByLabel("Stanje poglavlja")).toHaveValue("done");
  });
});
