// ED-01c (NF2-P2): the save chip is calm and one region speaks only when the
// level changes; offline the chip and the notice say how many changes wait;
// when the network returns, "Veza je vraćena." stays until nothing waits and
// never says the server. Invented assignment, invented server.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import type { BrowserContext } from "@playwright/test";

import { expect, test, type Page } from "./fixtures/test";

import { messagesHr } from "../../../src/lib/i18n/messages.hr";

const t = messagesHr.workspace;
const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1f";
const SCOPE = "b".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0002";
const PATH = `/app/web/rad/${ID}`;

/** The invented server: the contract's opened work; a commit is never answered, so every change keeps waiting. */
async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o mjesnim knjižnicama", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  // evidence/open: the shared fake answers with the contract's own opened work (fixtures/test).
  await page.route("**/api/v1/evidence/commit", () => { /* never answered: the change waits */ });
}

const bar = (page: Page) => page.locator('footer[aria-label="Stanje rada"]');
const chip = (page: Page) => bar(page).locator("[data-tone]").first();
const said = (page: Page) => bar(page).getByRole("status");
// Case matters: the chip says "čeka slanje" in lower case.
const notice = (page: Page, text: string) => page.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

async function openEditor(page: Page) {
  await server(page);
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  return editor;
}

async function typeOffline(page: Page, context: BrowserContext) {
  const editor = await openEditor(page);
  await context.setOffline(true);
  await expect(chip(page)).toContainText("Izvan mreže");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Izmišljena druga rečenica.");
  await expect(chip(page)).toContainText(/čeka slanje: \d+ izmjen/, { timeout: 15_000 });
}

test("the bar has one region that speaks, empty while the level stays the same", async ({ page }) => {
  await openEditor(page);
  await expect(said(page)).toHaveCount(1);
  await expect(said(page)).toHaveText("");
  // The chip itself is not a live region.
  await expect(chip(page)).not.toHaveAttribute("role", "status");
});

test("offline: the chip and the notice say how many changes wait, the region says it once", async ({ page, context }) => {
  await typeOffline(page, context);
  await expect(chip(page)).toContainText("Izvan mreže · Spremljeno na uređaju · čeka slanje:");
  await expect(notice(page, "Čeka slanje:")).toBeVisible();
  await expect(said(page)).toHaveText(t.saveLevel.offline);
  // Typing more stays on the same level: nothing new is said.
  await page.keyboard.type(" Još malo.");
  await expect(said(page)).toHaveText(t.saveLevel.offline);
});

test("network back: Veza je vraćena stays while changes wait and never says the server", async ({ page, context }) => {
  await typeOffline(page, context);
  await context.setOffline(false);
  const back = page.getByText(messagesHr.workspace.saveLevel.server, { exact: false });
  await expect(notice(page, "Veza je vraćena.")).toBeVisible();
  await expect(page.getByText(/Veza je vraćena\. Šalje se \d+ izmjen/)).toBeVisible();
  await expect(chip(page)).not.toContainText("Izvan mreže");
  await expect(chip(page)).not.toContainText("poslužitelj");
  // The commit is never answered, so it stays.
  await page.waitForTimeout(3_000);
  await expect(notice(page, "Veza je vraćena.")).toBeVisible();
  await expect(back).toHaveCount(0);
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`a11y: ${width} px, ${theme}: offline notice and chip pass axe, no overflow, focus visible`, async ({ page, context }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await typeOffline(page, context);
      await setTheme(page, theme);
      await axe(page, info, `save-status-${width}-${theme}`);
      const box = await bar(page).boundingBox();
      expect(box && box.x + box.width).toBeLessThanOrEqual(width);
      expect(await hiddenFocus(page)).toEqual([]);
    });
  }
}
