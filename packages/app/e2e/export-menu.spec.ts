// ED-06 (NF2-P23): "Izvezi ▾" offers "Pregled ispisa", which opens the page's own print preview, and the copy
// of the work's text says how it went in a toast (prototype ACT.copy). Invented assignment, invented server.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4f";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d3f";
const SCOPE = "c".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0006";
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
  // evidence/open: the shared fake answers with the contract's own opened work (fixtures/test).
}

async function openEditor(page: Page) {
  await server(page);
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Izmišljena rečenica.");
  return editor;
}

const exportMenu = (page: Page) => page.getByRole("button", { name: "Izvezi ▾" });
const item = (page: Page, name: string) => page.getByRole("menuitem", { name });

async function choose(page: Page, name: string) {
  await exportMenu(page).click();
  await item(page, name).click();
}

test.describe("ED-06 Izvezi", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Izvezi offers Pregled ispisa before the copy", async ({ page }) => {
    await openEditor(page);
    await exportMenu(page).click();
    const names = await page.getByRole("menuitem").allInnerTexts();
    // WEB-V21-STEM-LATEX-IZVOZ: the LaTeX item follows; the fixture's work is not in schema v4, so it is off and says why.
    expect(names.map((n) => n.trim().split("\n")[0])).toEqual(["Pregled ispisa", "Stavi tekst rada u međuspremnik", "LaTeX (rad.tex)"]);
    await expect(item(page, "LaTeX (rad.tex)")).toBeDisabled();
  });

  test("Pregled ispisa opens the print preview", async ({ page }) => {
    await openEditor(page);
    await choose(page, "Pregled ispisa");
    await expect(page.getByRole("dialog", { name: "Pregled ispisa" })).toBeVisible();
  });

  test("the copy puts the text on the clipboard and says so", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openEditor(page);
    await choose(page, "Stavi tekst rada u međuspremnik");
    await expect(page.getByText("Tekst je stavljen u međuspremnik.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Izmišljena rečenica.");
  });

  test("a refused copy tells the student to use Ctrl+C", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("odbijeno")) } });
    });
    await openEditor(page);
    await choose(page, "Stavi tekst rada u međuspremnik");
    await expect(page.getByText("Nije uspjelo. Označite tekst i upotrijebite Ctrl+C.")).toBeVisible();
  });

  test("the menu works from the keyboard", async ({ page }) => {
    await openEditor(page);
    await exportMenu(page).focus();
    await page.keyboard.press("Enter");
    await expect(item(page, "Pregled ispisa")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Pregled ispisa" })).toBeVisible();
  });
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`ED-06 copy toast and print preview: a11y ${width} ${theme}`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.setViewportSize({ width, height: 900 });
      await openEditor(page);
      await setTheme(page, theme);
      await exportMenu(page).dispatchEvent("click");
      await item(page, "Stavi tekst rada u međuspremnik").click();
      await expect(page.getByText("Tekst je stavljen u međuspremnik.")).toBeVisible();
      await axe(page, test.info(), `ed06-toast-${width}-${theme}`);
      await exportMenu(page).dispatchEvent("click");
      await item(page, "Pregled ispisa").click();
      const dialog = page.getByRole("dialog", { name: "Pregled ispisa" });
      await expect(dialog).toBeVisible();
      await axe(page, test.info(), `ed06-print-${width}-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);
    });
  }
}
