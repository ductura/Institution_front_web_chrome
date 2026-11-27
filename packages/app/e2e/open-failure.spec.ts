// ED-01b (NF2-P1, G-1 and G-2): a work that cannot be opened says why, in
// role="alert", with one way out per cause; the frame of /rad/<id> and the
// editor's own sheet say the same sentence for the same cause. Invented
// assignment and invented server only.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import { expect, test, type Page, type Route } from "./fixtures/test";

import { messagesHr } from "../../../src/lib/i18n/messages.hr";

const t = messagesHr.workspace;
const ID = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e5f7";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1f";
const TITLE = "Izmišljeni seminar o gradskim vrtovima";
const PATH = `/aplikacija/rad/${ID}`;
const SCOPE = "a".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0001";

type Answer = (route: Route) => Promise<void>;
const refuse = (status: number, code?: string): Answer => (route) =>
  route.fulfill({ status, json: code === undefined ? { error: "x" } : { status: code } });
const drop: Answer = (route) => route.abort("internetdisconnected");

/** The invented server: a started work; `open` answers evidence/open, `frame` the assignments. */
async function server(page: Page, open: Answer[], frame?: Answer) {
  const seen = { opens: 0 };
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => frame ? frame(route) : route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: TITLE, dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route("**/api/v1/evidence/open", (route) => {
    const answer = open[Math.min(seen.opens, open.length - 1)] ?? refuse(503);
    seen.opens += 1;
    return answer(route);
  });
  return seen;
}

const alert = (page: Page) => page.locator("[data-open-failure]");

const SHEET: ReadonlyArray<[string, Answer, "missing" | "closed" | "reload" | "server" | "offline", RegExp]> = [
  ["404 not_found", refuse(404, "not_found"), "missing", /\/aplikacija\/zadaci$/],
  ["409 not_accepting", refuse(409, "not_accepting"), "closed", new RegExp(`/aplikacija/zadatak/${ID}$`)],
  ["426", refuse(426, "upgrade_required"), "reload", /./],
  ["503", refuse(503), "server", /./],
  ["no network", drop, "offline", /./],
];

for (const [name, answer, failure, href] of SHEET) {
  test(`sheet, ${name}: the cause in role=alert with its one way out`, async ({ page }) => {
    await server(page, [answer]);
    await page.goto(PATH);
    const box = alert(page);
    await expect(box).toHaveAttribute("data-open-failure", failure);
    await expect(box).toHaveAttribute("role", "alert");
    await expect(box).toContainText(t.openFailure[failure]);
    if (failure === "missing" || failure === "closed") {
      const link = box.getByRole("link");
      await expect(link).toHaveText(failure === "missing" ? t.openBackToTasks : t.openNoticeLink);
      expect(await link.getAttribute("href")).toMatch(href);
    } else {
      await expect(box.getByRole("button")).toHaveText(failure === "reload" ? t.openReloadButton : t.openRetry);
    }
    // The one generic sentence is gone.
    await expect(page.getByText("Rad se ne može otvoriti.", { exact: true })).toHaveCount(0);
  });
}

test("sheet: no network, then Pokušaj ponovno reads again and names the new cause", async ({ page }) => {
  const seen = await server(page, [drop, refuse(503)]);
  await page.goto(PATH);
  await expect(alert(page)).toHaveAttribute("data-open-failure", "offline");
  await alert(page).getByRole("button", { name: t.openRetry }).click();
  await expect(alert(page)).toHaveAttribute("data-open-failure", "server");
  expect(seen.opens).toBe(2);
});

test("sheet: a sign-in without a journal scope, sign in again and come back to this work", async ({ page }) => {
  const seen = await server(page, [refuse(503)]);
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({ json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } } }));
  await page.goto(PATH);
  const box = alert(page);
  await expect(box).toHaveAttribute("data-open-failure", "signedOut");
  const link = box.getByRole("link", { name: t.openSignIn });
  const href = new URL((await link.getAttribute("href")) ?? "", "http://127.0.0.1");
  expect(href.searchParams.get("returnTo")).toBe(PATH);
  // Fail closed: without a scope the work is not even opened.
  expect(seen.opens).toBe(0);
});

test("frame: the assignments read fails, the frame says the same sentence as the sheet", async ({ page }) => {
  await server(page, [refuse(503)], refuse(503));
  await page.goto(PATH);
  await expect(alert(page)).toHaveAttribute("data-open-failure", "server");
  await expect(alert(page)).toContainText(t.openFailure.server);
  await expect(alert(page).getByRole("button", { name: t.openRetry })).toBeVisible();
});

test("frame: no network on the assignments read is the offline cause", async ({ page }) => {
  await server(page, [refuse(503)], drop);
  await page.goto(PATH);
  await expect(alert(page)).toHaveAttribute("data-open-failure", "offline");
  await expect(alert(page)).toContainText(t.openFailure.offline);
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`a11y: ${width} px, ${theme}: axe, no overflow, the way out by keyboard`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await server(page, [refuse(404, "not_found")]);
      await page.goto(PATH);
      await expect(alert(page)).toHaveAttribute("data-open-failure", "missing");
      await setTheme(page, theme);
      await axe(page, info, `open-failure-${width}-${theme}`);
      const box = await alert(page).boundingBox();
      expect(box && box.x + box.width).toBeLessThanOrEqual(width);
      expect(await hiddenFocus(page)).toEqual([]);
      const link = alert(page).getByRole("link", { name: t.openBackToTasks });
      await link.focus();
      await expect(link).toBeFocused();
    });
  }
}
