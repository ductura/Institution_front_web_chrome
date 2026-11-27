// ED-04 (NF2-P6): beside "n riječi · opseg min do max" the bar states where the text stands
// ("još n do donje granice", "unutar opsega", "iznad gornje granice za n"), without colour; a
// polite region says only the crossing of a limit, never the opening and never typing inside a
// band. Invented assignment, invented server; the range comes from student.assignment-requirements.get.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c5a";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0e1f";
const SCOPE = "b".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0004";
const PATH = `/aplikacija/rad/${ID}`;

type Range = { min: number; max: number } | null;

async function server(page: Page, range: () => Range) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o riječnim lukama", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route(`**/api/v1/student/assignments/${ID}/requirements`, (route) => route.fulfill({ json: { wordRange: range() } }));
  // evidence/open: the shared fake answers with the contract's own opened work (fixtures/test).
}

const bar = (page: Page) => page.locator('footer[aria-label="Stanje rada"]');
const said = (page: Page) => bar(page).locator('[aria-live="polite"]');

async function open(page: Page, range: Range | (() => Range)) {
  await server(page, typeof range === "function" ? range : () => range);
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await expect(bar(page)).toContainText(/\d+ riječ/);
  return editor;
}

/** The count the bar shows for the contract's opened work. */
async function wordsNow(page: Page): Promise<number> {
  const text = await bar(page).innerText();
  return Number(/([\d.]+) riječ/.exec(text)![1]!.replace(/\./g, ""));
}

async function typeAtEnd(page: Page, text: string) {
  await page.locator('.ProseMirror[contenteditable="true"]').first().focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}

test("below, within and over the range: the line states the fact, the region says only each crossing", async ({ page }) => {
  let range: Range = null;
  await open(page, () => range);
  const w = await wordsNow(page);
  await expect(bar(page)).not.toContainText("granic");

  range = { min: w + 2, max: w + 4 };
  await page.reload();
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(bar(page)).toContainText(`opseg ${w + 2} do ${w + 4} · još 2 do donje granice`);
  // Opening the work says nothing.
  await expect(said(page)).toHaveText("");

  await typeAtEnd(page, " jedan");
  await expect(bar(page)).toContainText("još 1 do donje granice");
  await expect(said(page)).toHaveText("");

  await typeAtEnd(page, " dva");
  await expect(bar(page)).toContainText("unutar opsega");
  await expect(said(page)).toHaveText("Opseg: unutar granica.");

  await typeAtEnd(page, " tri četiri pet");
  await expect(bar(page)).toContainText("iznad gornje granice za 1");
  await expect(said(page)).toHaveText("Opseg: iznad gornje granice za 1 riječ.");

  // Typing on above the limit changes the fact, and the region stays with the last crossing.
  await typeAtEnd(page, " šest");
  await expect(bar(page)).toContainText("iznad gornje granice za 2");
  await expect(said(page)).toHaveText("Opseg: iznad gornje granice za 1 riječ.");

  for (let i = 0; i < 2; i++) await page.keyboard.press("Control+Backspace");
  await expect(bar(page)).toContainText("unutar opsega");
  await expect(said(page)).toHaveText("Opseg: unutar granica.");
});

test("the fact has no colour of its own: it is the bar's ink", async ({ page }) => {
  await open(page, { min: 100000, max: 200000 });
  const scope = bar(page).getByText(/do donje granice/);
  await expect(scope).toBeVisible();
  const [own, ink] = await scope.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.closest("footer")!).color]);
  expect(own).toBe(ink);
});

test("without a range the bar shows no fact and the region stays silent", async ({ page }) => {
  await open(page, null);
  await typeAtEnd(page, " jedan dva tri");
  await expect(bar(page)).not.toContainText("granic");
  await expect(bar(page)).not.toContainText("opsega");
  await expect(said(page)).toHaveText("");
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`a11y: ${width} px, ${theme}: the scope line passes axe, wraps without overflow, focus visible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setTheme(page, theme);
      await open(page, { min: 100000, max: 200000 });
      await expect(bar(page)).toContainText("do donje granice");
      await axe(page, test.info(), `opseg ${width} ${theme}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      await page.keyboard.press("Tab");
      expect(await hiddenFocus(page)).toEqual([]);
    });
  }
}
