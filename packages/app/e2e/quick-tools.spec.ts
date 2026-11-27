// ED-31 (P2-1b): the context button follows the cursor, Prikaz sets the text size on the screen, and a phone
// gets "Brzi alati" above the keyboard with only the tools this editor has. Invented assignment, invented server.
import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d31";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0031";
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

async function openEditor(page: Page) {
  await server(page);
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  return editor;
}

test.describe("ED-31 on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the context button turns a chapter into a subchapter", async ({ page }) => {
    const editor = await openEditor(page);
    const button = page.getByRole("button", { name: "Naslov ▾" });
    await expect(button).toHaveCount(0);
    await page.keyboard.type("Izmišljeno poglavlje");
    await page.keyboard.press("Control+Alt+2");
    await expect(editor.locator("h2", { hasText: "Izmišljeno poglavlje" })).toBeVisible();
    await button.click();
    await expect(page.getByRole("menuitem", { name: "✓ Poglavlje" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Potpoglavlje" }).click();
    await expect(editor.locator("h3", { hasText: "Izmišljeno poglavlje" })).toBeVisible();
  });

  test("Prikaz makes the text on the screen larger, keeps it, and says export stays", async ({ page }) => {
    await openEditor(page);
    const sheet = page.locator(".manuscript").first();
    const size = () => sheet.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size()).toBeCloseTo(16.5, 1);
    await page.getByRole("button", { name: "Prikaz ▾" }).click();
    await page.getByRole("menuitem", { name: "Veći tekst (100 %)" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "115");
    await expect(page.getByText("Tekst na zaslonu: 115 %. Izvoz i ispis ostaju po pravilima fakulteta.")).toBeVisible();
    expect(await size()).toBeCloseTo(16.5 * 1.15, 1);
    await page.reload();
    await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "115");
    await page.getByRole("button", { name: "Prikaz ▾" }).click();
    await page.getByRole("menuitem", { name: "Manji tekst" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-text-size", /.*/);
    expect(await size()).toBeCloseTo(16.5, 1);
  });

  test("no Brzi alati on a wide screen", async ({ page }) => {
    await openEditor(page);
    await expect(page.getByRole("toolbar", { name: "Brzi alati" })).toHaveCount(0);
  });
});

test.describe("ED-31 on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("Brzi alati shows while writing, with only the tools this editor has", async ({ page }) => {
    const editor = await openEditor(page);
    const bar = page.getByRole("toolbar", { name: "Brzi alati" });
    await expect(bar).toBeVisible();
    const names = (await bar.getByRole("button").allInnerTexts()).map((n) => n.trim());
    // ED-100: Navod opens the citation popover of the sources panel, so it is on the bar again.
    expect(names).toEqual(["Poništi", "Navod", "Za provjeru", "Više"]);

    await page.keyboard.type("Izmišljena rečenica.");
    await bar.getByRole("button", { name: "Poništi" }).click();
    await expect(editor).not.toContainText("Izmišljena rečenica.");

    await bar.getByRole("button", { name: "Više" }).click();
    const more = (await page.getByRole("menuitem").allInnerTexts()).map((n) => n.trim());
    expect(more).toEqual(["Ponovi", "Podebljano", "Kurziv"]);
    await page.getByRole("menuitem", { name: "Ponovi" }).click();
    await expect(editor).toContainText("Izmišljena rečenica.");
  });
});
