// WEB-V14-SHEET-GRID / F4-V14-R03: keyboard use and accessibility of the spreadsheet grid at 1250 and 400 px, on the real
// work page. The page opens the grid for a task whose kind is a table (`workKind: "spreadsheet"` beside
// `documentKind: "text"`, SRV-V14-KIND-ENUM v2); the opening is revision 0 of a table. The receipt keys are the
// contract's own invented test keys; people, courses and ids are invented.
import { readFileSync } from "node:fs";

import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c5a";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d5a";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-1409";
const PATH = `/aplikacija/rad/${ID}`;
const DOCUMENT_ID = "dokument-izmisljena-tablica-1";
// packages/editor-core/src/sheet/steps.ts: sheetRevisionZeroDocument() as JCS and SHEET_REVISION_ZERO_SHA256.
const ZERO_JCS = '{"kind":"spreadsheet","schemaVersion":1,"sheets":[{"cells":{},"columns":10,"id":"00000000-0000-4000-8000-000000000000","name":"List1","rows":100}]}';
const ZERO_SHA256 = "70f7ffa27faf9f771316120c2b2f94e351aed32af3b94177d4c85ff56b0066e4";

type Vector = { route: string; name: string; response?: { body?: { receiptKeys?: unknown } } };
const vectors = JSON.parse(readFileSync(new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8")) as Vector[];
const receiptKeys = vectors.find((v) => v.route === "evidence.open.post" && v.name === "opened")?.response?.body?.receiptKeys;

async function openSheet(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljena tablica troškova", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false, documentKind: "text", workKind: "spreadsheet" },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route("**/api/v1/evidence/open", (route) => route.fulfill({
    json: {
      status: "opened", documentId: DOCUMENT_ID, evidenceProfileId: "standard-v1", currentRevision: 0, documentHash: ZERO_SHA256,
      headSegmentHash: null, lastSequenceTo: 0, document: Buffer.from(ZERO_JCS, "utf8").toString("base64"), receiptKeys,
      submitted: false, lastSignedAt: null, documentKind: "text", workKind: "spreadsheet",
    },
  }));
  // Nothing is confirmed in these tests; a commit, if one left, waits unanswered on this device.
  await page.route("**/api/v1/evidence/commit", () => { /* never answered */ });
  await page.goto(PATH);
  const grid = page.getByRole("grid", { name: /Tablica/ });
  await expect(grid).toBeVisible({ timeout: 20_000 });
  return grid;
}

const cell = (page: Page, ref: string) => page.locator(`[data-cell="${ref}"]`);

async function fill(page: Page, ref: string, text: string, finish = "Enter") {
  await cell(page, ref).focus();
  await page.keyboard.press("F2");
  await page.keyboard.type(text);
  await page.keyboard.press(finish);
}

for (const width of [1250, 400]) {
  test.describe(`SheetGrid at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("keys: arrows, F2, Enter, Tab, Esc and Ctrl+Z", async ({ page }) => {
      await openSheet(page);
      await fill(page, "A1", "10");
      await fill(page, "A2", "32");
      await fill(page, "A3", "=SUM(A1:A2)");
      await expect(cell(page, "A3")).toHaveText("42");

      await cell(page, "A1").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await expect(cell(page, "B2")).toBeFocused();

      await page.keyboard.press("F2");
      await page.keyboard.type("odustani");
      await page.keyboard.press("Escape");
      await expect(cell(page, "B2")).toHaveText("");
      await expect(cell(page, "B2")).toBeFocused();

      await fill(page, "B2", "tab", "Tab");
      await expect(cell(page, "C2")).toBeFocused();

      await page.keyboard.press("Control+z");
      await expect(cell(page, "B2")).toHaveText("");
    });

    test("range selection and an error value read out in words", async ({ page }) => {
      await openSheet(page);
      await fill(page, "A1", "0");
      await fill(page, "B1", "=1/A1");
      await expect(cell(page, "B1")).toHaveText("#DIV/0!");
      await expect(cell(page, "B1")).toHaveAttribute("aria-label", /dijeljenje nulom/);
      await cell(page, "A1").focus();
      await page.keyboard.press("Shift+ArrowRight");
      await page.keyboard.press("Shift+ArrowDown");
      await expect(page.locator('[role="gridcell"][aria-selected="true"]')).toHaveCount(4);
    });

    for (const theme of ["dark", "light"] as const) {
      test(`axe and visible focus (${theme})`, async ({ page }, info) => {
        await openSheet(page);
        await fill(page, "A1", "5");
        await fill(page, "B1", "=A1*2");
        await setTheme(page, theme);
        await axe(page, info, `sheet-grid-${width}-${theme}`);
        expect(await hiddenFocus(page, 20)).toEqual([]);
      });
    }
  });
}
