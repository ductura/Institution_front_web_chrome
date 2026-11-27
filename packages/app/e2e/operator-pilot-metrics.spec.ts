// WEB-NUZ-OPERATER (NF-7 OA-1, OA-12): the operator's page in the host, over a fake institution
// server (page.route). Only an account with network_engineer opens it, and its "/" leads there;
// every other account is refused without the measures being read. The page shows only the eight
// aggregates of ops.pilot-metrics.get, with the prototype's states. Invented data only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const PAGE = "/aplikacija/operater/mjerila-pilota";
const ME = (roles: string[]) => ({ roles, displayName: "Operater A", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const FULL = {
  asOf: "2026-11-20T23:00:00.000Z",
  minimumGroup: 5,
  submissions: { recorded: 10, notRecorded: 5 },
  receipts: { issued: 5, pending: null },
  helpRequests: { total: 10, saveProblems: 5 },
  receiptTime: { p50Ms: 3000, p95Ms: 4800 },
};
const EMPTY = {
  ...FULL,
  submissions: { recorded: 0, notRecorded: 0 },
  receipts: { issued: 0, pending: 0 },
  helpRequests: { total: 0, saveProblems: 0 },
  receiptTime: { p50Ms: null, p95Ms: null },
};
type Reply = { status: number; body: unknown };

/** The session of `roles` and the measures' answers in turn (the last one repeats); counts the reads of the measures. */
async function fakeServer(page: Page, roles: string[], ...replies: Reply[]) {
  const seen = { metrics: 0 };
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(roles) }));
  await page.route("**/api/v1/ops/pilot-metrics", (route) => {
    const reply = replies[Math.min(seen.metrics, replies.length - 1)] ?? { status: 200, body: FULL };
    seen.metrics += 1;
    return route.fulfill({ status: reply.status, json: reply.body });
  });
  return seen;
}
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical");

test("the operator lands on its own page from the app's home, inside the shell", async ({ page }) => {
  await fakeServer(page, ["network_engineer"], { status: 200, body: FULL });
  await page.goto("/aplikacija/");
  await expect(page).toHaveURL(/\/aplikacija\/operater\/mjerila-pilota$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mjerila pilota");
  await expect(page).toHaveTitle("Mjerila pilota · Ductura");
  await expect(page.getByRole("complementary", { name: "Bočna navigacija" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odjava" })).toBeVisible();
  await expect(page.getByText("Ovaj račun još nema ulogu", { exact: false })).toHaveCount(0);
});

test("only the allowed aggregates are shown, a hidden one as hidden; axe at 1250 and 400 px", async ({ page }) => {
  const seen = await fakeServer(page, ["network_engineer"], { status: 200, body: FULL });
  await page.setViewportSize({ width: 1250, height: 900 });
  await page.goto(PAGE);
  const table = page.getByRole("table", { name: "Zbirna mjerila pilota" });
  await expect(table.getByRole("row")).toHaveCount(9);
  await expect(table.getByRole("row", { name: /Zabilježene predaje/ })).toContainText("10");
  await expect(table.getByRole("row", { name: /Predaje bez potvrde/ })).toContainText("Nije prikazano (manje od 5)");
  await expect(table.getByRole("row", { name: /medijan/ })).toContainText("3.000 ms");
  await expect(page.getByText("Prag je 5 zapisa.", { exact: false })).toBeVisible();
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  expect(seen.metrics).toBe(1);
  expect(await serious(page)).toEqual([]);
  await page.setViewportSize({ width: 400, height: 860 });
  expect(await serious(page)).toEqual([]);
});

test("an answer outside the aggregate contract is never shown, and Pokušaj ponovno reads again", async ({ page }) => {
  const seen = await fakeServer(page, ["network_engineer"],
    { status: 200, body: { ...FULL, helpRequests: { ...FULL.helpRequests, person: "demo-operator" } } },
    { status: 200, body: FULL });
  await page.goto(PAGE);
  await expect(page.locator("main").getByRole("alert")).toHaveText("Mjerila pilota trenutačno nisu dostupna.");
  await expect(page.getByText("demo-operator")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect(page.getByRole("table", { name: "Zbirna mjerila pilota" })).toBeVisible();
  expect(seen.metrics).toBe(2);
});

test("no measures yet shows the empty state", async ({ page }) => {
  await fakeServer(page, ["network_engineer"], { status: 200, body: EMPTY });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { name: "Još nema mjerila" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});

test("the server's refusal is shown as a refusal, without numbers", async ({ page }) => {
  await fakeServer(page, ["network_engineer"], { status: 403, body: { error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status: 403 } });
  await page.goto(PAGE);
  await expect(page.locator("main").getByRole("alert")).toHaveText("Za pregled mjerila potreban je operaterski pristup.");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pokušaj ponovno" })).toHaveCount(0);
});

for (const roles of [["institution_admin"], ["teacher"], ["student"]]) {
  test(`a ${roles[0]} account is refused and the measures are never read`, async ({ page }) => {
    const seen = await fakeServer(page, roles, { status: 200, body: FULL });
    await page.goto(PAGE);
    await expect(page).toHaveURL(/\/aplikacija\/nema-ovlasti\?kind=denied$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nemate ovlasti za ovaj prikaz");
    await expect(page.getByText("Zabilježene predaje")).toHaveCount(0);
    expect(seen.metrics).toBe(0);
  });
}
