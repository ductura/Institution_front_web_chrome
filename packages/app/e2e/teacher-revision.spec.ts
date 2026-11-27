// #594 review, point 1 (WEB-NF4-DORADA-2): the teacher's revision request on the N-06 work page. The banner names
// what the student sees and links to the comparison with the submitted version; "Povuci zahtjev" asks first, sends
// the contract's withdraw with {requestId, expectedSeq} and says so only after the server confirmed. axe A/AA at
// 390 and 1280 px in the light and the dark theme, and the whole withdrawal by keyboard. Invented data only.
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "./fixtures/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";
import { axe, setTheme } from "./a11y/check";
import { revisionMessages as t } from "../src/host/teacher/revision/messages.hr";

const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const vector = <T,>(route: string, name: string) => vectors.find((v) => v.route === route && v.name === name)!.response.body as unknown as T;
// teacher.work.get "middle-work" is a submitted work; alone here, so no previous or next work.
const workBody = { ...vector<{ documentId: string }>("teacher.work.get", "middle-work"), prevDocumentId: null, nextDocumentId: null };
const documentId = workBody.documentId;
const profileBody = { ...vector<object>("profile.me.get", "teacher-without-name"), roles: ["teacher"] };
const listed = vector<{ requests: Record<string, unknown>[] }>("collaboration.revision-requests.post", "listed");
const REQUEST_ID = "8b7a6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c01";
const INSTRUCTION = "Izmišljena uputa za doradu.";
const openRow = listed.requests.find((r) => r.request_id === REQUEST_ID)!;
const withdrawnRow = {
  ...openRow, request_state: "withdrawn", request_row_seq: 2,
  closed_as: "withdrawn", closed_is_own: true, closed_window: "2026-11-05T12:00:00.000Z",
};
const work = `/aplikacija/nastavnik/rad/${encodeURIComponent(documentId)}`;

/** The work page's reads, with one open request until the withdraw is confirmed. */
async function fakeServer(page: Page, withdrawStatus = 200) {
  let withdrawn = false;
  const withdraws: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    switch (url.pathname) {
      case "/api/v1/me": return route.fulfill({ json: profileBody });
      case "/api/v1/teacher/access": return route.fulfill({ json: { access: "allowed", scope: "a".repeat(64) } });
      case "/api/v1/teacher/courses": return route.fulfill({ json: { courses: [] } });
      case "/api/v1/profile/interface-locale": return route.fulfill({ json: { locale: null } });
      case `/api/v1/teacher/works/${documentId}`: return route.fulfill({ json: workBody });
      case "/api/v1/revision-requests/list": return route.fulfill({ json: { requests: [withdrawn ? withdrawnRow : openRow] } });
      case "/api/v1/revision-requests/withdraw": {
        withdraws.push(route.request().postDataJSON());
        if (withdrawStatus !== 200) {
          return route.fulfill({ status: withdrawStatus, json: { row_seq: 3, version: 1, state: "responded", outcome: "conflict" } });
        }
        withdrawn = true;
        return route.fulfill({ json: { outcome: "applied", row_seq: 2, version: 1, state: "withdrawn" } });
      }
      case "/api/v1/process-summary": return route.fulfill({ status: 404, json: { error: "not_found" } });
      case "/api/v1/comments/list": return route.fulfill({ json: { comments: [] } });
      case `/api/v1/works/${documentId}/milestones`: return route.fulfill({ json: { milestones: [] } });
      // Everything else goes to the shared fake server, which fails outside the contract.
      default: return route.fallback();
    }
  });
  return { withdraws };
}

const banner = (page: Page) => page.locator(".banner").filter({ hasText: t.studentSees });

for (const width of [390, 1280]) {
  test(`revision banner at ${width} px: Student vidi, comparison link and axe in both themes`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await fakeServer(page);
    await page.goto(work);
    await expect(banner(page)).toContainText(`${t.studentSees} „${INSTRUCTION}”`);
    await expect(banner(page).getByRole("link", { name: t.compare })).toHaveAttribute("href", `${work}/usporedba`);
    await expect(banner(page).getByRole("button", { name: t.withdraw })).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await axe(page, info, `revision-banner-${theme}-${width}`);
    }
    await banner(page).getByRole("button", { name: t.withdraw }).click();
    const dialog = page.getByRole("dialog", { name: t.withdrawTitle });
    await expect(dialog).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await axe(page, info, `revision-withdraw-dialog-${theme}-${width}`);
    }
  });
}

test("Povuci zahtjev by keyboard: asks, sends {requestId, expectedSeq}, confirms only after the server", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { withdraws } = await fakeServer(page);
  await page.goto(work);
  const withdraw = banner(page).getByRole("button", { name: t.withdraw });
  await expect(withdraw).toBeVisible();

  // Escape closes the question and sends nothing.
  await withdraw.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: t.withdrawTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(t.withdrawExplain);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(withdraw).toBeFocused();
  expect(withdraws).toEqual([]);

  // Tab stays inside the dialog and reaches the confirmation.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: t.cancel })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: t.withdrawConfirm })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText(t.withdrawn)).toBeVisible();
  expect(withdraws).toEqual([{ requestId: REQUEST_ID, expectedSeq: 1 }]);
  await expect(banner(page)).toHaveCount(0);
});

test("a refused withdraw keeps the request and names the refusal", async ({ page }) => {
  const { withdraws } = await fakeServer(page, 409);
  await page.goto(work);
  await banner(page).getByRole("button", { name: t.withdraw }).click();
  await page.getByRole("dialog", { name: t.withdrawTitle }).getByRole("button", { name: t.withdrawConfirm }).click();
  await expect(page.locator("p[role=alert]").filter({ hasText: t.errors.conflict })).toBeVisible();
  await expect(page.getByText(t.withdrawn)).toHaveCount(0);
  await expect(banner(page).getByRole("button", { name: t.withdraw })).toBeVisible();
  expect(withdraws).toHaveLength(1);
});
