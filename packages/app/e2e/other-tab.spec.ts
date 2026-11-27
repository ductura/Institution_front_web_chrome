// ED-22 (NF2-P26): a second tab of the same work saves nothing and says so, with the server's minute of
// the last signed save from the open answer (lastSignedAt). Invented assignment, invented server.
import { axe, setTheme } from "./a11y/check";
import { generatedDefaults } from "./fixtures/contract-api";
import { expect, test, type Page } from "./fixtures/test";

import { messagesHr } from "../../../src/lib/i18n/messages.hr";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c22";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d22";
const SCOPE = "e".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0022";
const PATH = `/aplikacija/rad/${ID}`;
const SIGNED = "2026-11-26T13:32:00.000Z";

const defaults = generatedDefaults();

/** The contract's own opened work with the server's minute of the last signed save. */
function openedWith(lastSignedAt: string | null): Record<string, unknown> {
  const answer = defaults.operation("POST", "/api/v1/evidence/open")?.answer;
  if (!answer) throw new Error("no default for evidence/open");
  return { ...(JSON.parse(String(answer.body)) as Record<string, unknown>), lastSignedAt };
}

/** A page of the same context gets the shared fake too (fixtures/test registers it on the first page only). */
async function sharedFake(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const answer = defaults.operation(route.request().method(), pathname)?.answer;
    if (!answer) throw new Error(`Fake API request ${route.request().method()} ${pathname} has no default`);
    return route.fulfill({ status: answer.status, contentType: answer.contentType, body: answer.body });
  });
}

async function server(page: Page, lastSignedAt: string | null) {
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
  await page.route("**/api/v1/evidence/open", (route) => route.fulfill({ json: openedWith(lastSignedAt) }));
}

async function openBoth(page: Page, lastSignedAt: string | null) {
  await server(page, lastSignedAt);
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  const second = await page.context().newPage();
  await sharedFake(second);
  await server(second, lastSignedAt);
  await second.goto(PATH);
  return second;
}

test.describe("ED-22 rad otvoren u drugoj kartici", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the second tab is read-only and says the server's last save", async ({ page }) => {
    const second = await openBoth(page, SIGNED);
    const hint = second.getByText(messagesHr.editor.blockedHint, { exact: false });
    await expect(hint).toBeVisible({ timeout: 20_000 });
    await expect(hint).toContainText("Zadnje spremanje na poslužitelju: 26. studenoga 2026. u 14:32.");
    await expect(second.locator('.ProseMirror[contenteditable="true"]')).toHaveCount(0);
  });

  test("without a signed save the hint names no time", async ({ page }) => {
    const second = await openBoth(page, null);
    const hint = second.getByText(messagesHr.editor.blockedHint, { exact: false });
    await expect(hint).toBeVisible({ timeout: 20_000 });
    await expect(hint).not.toContainText("Zadnje spremanje");
  });

  for (const theme of ["dark", "light"] as const) {
    test(`axe 1280 ${theme}`, async ({ page }) => {
      const second = await openBoth(page, SIGNED);
      await expect(second.getByText(messagesHr.editor.blockedHint, { exact: false })).toBeVisible({ timeout: 20_000 });
      await setTheme(second, theme);
      await axe(second, test.info(), `ed22-druga-kartica-${theme}`);
    });
  }
});
