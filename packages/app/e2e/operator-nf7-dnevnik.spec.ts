// NF-7 OA-3, OA-6, OA-7 over a fake institution server (page.route); invented data only.
// OA-3 "Dnevnik radnji" and OA-7 "Prijave problema" read institution.admin-actions.get and
// support.problem-reports.get (and set a report's state) through the shared client: loading, empty,
// error and "no authority" are all shown. OA-6: the export requests show
// their state in words, and a second request for the same student is refused (on the page and on 409).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ME = (roles: string[]) => ({ roles, displayName: "Operater A", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const WARNING = "Za ovog studenta već postoji otvoren zahtjev za izvoz. Novi zahtjev nije zabilježen.";
const STUDENT = "0b6d6f1e-3c1a-4f7e-9a51-2f4a7d3c9e10";
const EXPORTS = {
  exports: [
    { exportId: "11111111-1111-4111-8111-111111111111", state: "requested", requestedAt: "2026-11-20T09:00:00.000Z", expiresAt: null },
    { exportId: "22222222-2222-4222-8222-222222222222", state: "approved", requestedAt: "2026-11-14T09:00:00.000Z", expiresAt: null },
    { exportId: "33333333-3333-4333-8333-333333333333", state: "downloaded", requestedAt: "2026-11-10T09:00:00.000Z", expiresAt: "2026-11-17T09:00:00.000Z" },
    { exportId: "44444444-4444-4444-8444-444444444444", state: "expired", requestedAt: "2026-10-28T09:00:00.000Z", expiresAt: "2026-11-04T09:00:00.000Z" },
  ],
};

const SHELL = ["/api/v1/notifications", "/api/v1/profile/interface-locale"];

/** The session of `roles`; every other /api/v1 call is counted, so a page that must read nothing can be checked. */
async function fakeServer(page: Page, roles: string[]) {
  const seen: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/api/v1/me")) return route.fulfill({ json: ME(roles) });
    // The shell's own reads (notifications, interface language) are not the page's.
    if (SHELL.some((path) => url.pathname.endsWith(path))) return route.fulfill({ status: 404, json: { error: "not_found" } });
    seen.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 404, json: { error: "not_found" } });
  });
  return seen;
}
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical");

const LOG = "/api/v1/institution/admin-actions";
const REPORTS = "/api/v1/problem-reports";
const ACTIONS = {
  truncated: false,
  entries: [
    { at: "2026-11-20T09:00:00.000Z", actorRole: "institution_admin", action: "rule_published", subjectRole: null, outcome: "completed" },
    { at: "2026-11-22T10:30:00.000Z", actorRole: "operator", action: "role_confirmed", subjectRole: "teacher", outcome: "completed" },
  ],
};
const report = (n: number, over: Record<string, unknown> = {}) => ({
  reference: `PR-00000000A${n}`, category: "technical", routedTo: "network_engineer", courseId: null, description: `Izmišljeni opis prijave ${n}`,
  route: "/student", appVersion: "1.2.3", browser: { family: "chromium", major: 130 }, syncState: null,
  createdAt: `2026-11-2${n}T09:00:00.000Z`, status: "received", statusChangedAt: null, statusChangedByRole: null, statusChangedByMe: false, ...over,
});

/** Answers one path with `status` and `json`; the fake server counts every other call. */
async function answer(page: Page, path: string, status: number, json: unknown) {
  await page.route(`**${path}`, (route) => route.fulfill({ status, json }));
}

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`OA-3, OA-7: the operator reads both pages from its home (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const seen = await fakeServer(page, ["network_engineer"]);
      await answer(page, LOG, 200, ACTIONS);
      await answer(page, REPORTS, 200, { truncated: false, reports: [report(1), report(2, { status: "resolved" })] });
      await page.goto("/app/web/operater/mjerila-pilota");
      await page.getByRole("link", { name: "Dnevnik radnji" }).click();
      await expect(page).toHaveURL(/\/operater\/dnevnik-radnji$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dnevnik radnji");
      const log = page.getByRole("table", { name: "Radnje administratora i operatera" });
      await expect(log.getByRole("row")).toHaveCount(3);
      await expect(log.getByRole("row").nth(1)).toContainText("Uloga potvrđena");
      expect(await serious(page)).toEqual([]);

      await page.goto("/app/web/operater/mjerila-pilota");
      await page.getByRole("link", { name: "Prijave problema" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prijave problema");
      const reports = page.getByRole("table", { name: "Prijave problema" });
      await expect(reports.getByRole("row")).toHaveCount(3);
      await expect(reports.getByRole("row").nth(1)).toContainText("Izmišljeni opis prijave 2");
      const routing = page.getByRole("table", { name: "Usmjeravanje prijava po kategoriji" });
      await expect(routing.getByRole("row", { name: /Tehnički problem/ })).toContainText("operater vaša");
      await expect(routing.getByRole("row", { name: /Račun i uloge/ })).not.toContainText("vaša");
      expect(await serious(page)).toEqual([]);
      expect(seen.filter((call) => !call.endsWith("/ops/pilot-metrics"))).toEqual([]);
    });
  }
}

test("OA-3, OA-7: empty, error with a retry, and no authority are each said in words", async ({ page }) => {
  await fakeServer(page, ["network_engineer"]);
  await answer(page, LOG, 200, { entries: [], truncated: false });
  await page.goto("/app/web/operater/dnevnik-radnji");
  await expect(page.getByText("Još nema zabilježenih radnji")).toBeVisible();

  await page.unroute(`**${LOG}`);
  let attempts = 0;
  await page.route(`**${LOG}`, (route) => (attempts++ === 0 ? route.fulfill({ status: 503, json: { error: "unavailable" } }) : route.fulfill({ json: ACTIONS })));
  await page.goto("/app/web/operater/dnevnik-radnji");
  await expect(page.getByText("Dnevnik radnji trenutačno nije moguće učitati. Pokušajte ponovno.")).toBeVisible();
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect(page.getByRole("table", { name: "Radnje administratora i operatera" })).toBeVisible();

  await answer(page, REPORTS, 403, { error: "forbidden" });
  await page.goto("/app/web/operater/prijave-problema");
  await expect(page.getByText("Nemate ovlasti za prijave problema.")).toBeVisible();
  await page.unroute(`**${REPORTS}`);
  await answer(page, REPORTS, 200, { reports: [], truncated: false });
  await page.goto("/app/web/operater/prijave-problema");
  await expect(page.getByText("Nema prijava")).toBeVisible();
});

test("OA-7: a report's state changes only after the server confirms it; a refusal leaves it as it was", async ({ page }) => {
  await fakeServer(page, ["network_engineer"]);
  await answer(page, REPORTS, 200, { truncated: false, reports: [report(1)] });
  const posts: { path: string; body: unknown }[] = [];
  let status = 200;
  await page.route("**/api/v1/problem-reports/*/status", (route) => {
    posts.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    return status === 200
      ? route.fulfill({ json: { reference: "PR-00000000A1", status: "resolved", statusChangedAt: "2026-11-24T08:00:00.000Z" } })
      : route.fulfill({ status, json: { error: "forbidden" } });
  });
  await page.goto("/app/web/operater/prijave-problema");
  const row = page.getByRole("table", { name: "Prijave problema" }).getByRole("row").nth(1);
  await expect(row).toContainText("zaprimljeno");
  status = 403;
  await row.getByRole("button", { name: /Označi riješenom/ }).click();
  await expect(page.getByText("Nemate ovlasti za promjenu stanja prijave PR-00000000A1.")).toBeVisible();
  await expect(row).toContainText("zaprimljeno");
  status = 200;
  await row.getByRole("button", { name: /Označi riješenom/ }).click();
  await expect(page.getByText("Stanje prijave PR-00000000A1 je promijenjeno.")).toBeVisible();
  await expect(row).toContainText("riješeno");
  expect(posts).toEqual([
    { path: "/api/v1/problem-reports/PR-00000000A1/status", body: { status: "resolved" } },
    { path: "/api/v1/problem-reports/PR-00000000A1/status", body: { status: "resolved" } },
  ]);
});

test("OA-3, OA-7: the administrator opens both pages and sees its own category; a teacher is refused", async ({ page }) => {
  await fakeServer(page, ["institution_admin"]);
  await answer(page, LOG, 200, ACTIONS);
  await answer(page, REPORTS, 200, { reports: [report(1, { category: "account", routedTo: "institution_admin" })], truncated: false });
  await page.goto("/app/web/operater/prijave-problema");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prijave problema");
  await expect(page.getByRole("table", { name: "Usmjeravanje prijava po kategoriji" }).getByRole("row", { name: /Račun i uloge/ }))
    .toContainText("administrator fakulteta vaša");
  await page.goto("/app/web/operater/dnevnik-radnji");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dnevnik radnji");

  await page.unrouteAll();
  const seen = await fakeServer(page, ["teacher"]);
  await page.goto("/app/web/operater/dnevnik-radnji");
  await expect(page).toHaveURL(/nema-ovlasti/);
  expect(seen.filter((call) => /admin-actions|problem-reports/.test(call))).toEqual([]);
});

/**
 * The export routes for a session of `roles`: the list as given, and the request's answers in turn
 * (the last one repeats). Only the registry office records a request (SRV-1308), so the POST is
 * answered only for a session that is not the administrator's; the administrator's would be a 403.
 */
async function fakeExports(page: Page, roles: string[], replies: number[]) {
  const seen = { list: 0, posts: 0 };
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(roles) }));
  await page.route("**/api/v1/institution/student-data-exports", (route) => {
    if (route.request().method() === "GET") { seen.list += 1; return route.fulfill({ json: EXPORTS }); }
    seen.posts += 1;
    if (roles.includes("institution_admin")) return route.fulfill({ status: 403, json: { error: "forbidden" } });
    const status = replies[Math.min(seen.posts - 1, replies.length - 1)] ?? 201;
    return status === 201
      ? route.fulfill({ status, json: { exportId: "55555555-5555-4555-8555-555555555555" } })
      : route.fulfill({ status, json: { error: "conflict" } });
  });
  return seen;
}

const REQUEST_FORM = "Zahtjev za izvoz podataka studenta";

async function requestFor(page: Page, studentId: string) {
  const form = page.getByRole("region", { name: REQUEST_FORM });
  await form.getByLabel("Oznaka studenta").fill(studentId);
  await form.getByLabel("Isprava kojom je provjeren identitet").selectOption("student_card");
  await form.getByLabel("Provjerio/la sam identitet studenta uživo").check();
  await form.getByLabel("Oznaka provjere").fill("Spis 12/2026");
  // Keyboard: the request is sent with Enter from the last field.
  await form.getByLabel("Oznaka provjere").press("Enter");
}

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`OA-6: the administrator sees the states in words and records nothing (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const seen = await fakeExports(page, ["institution_admin"], [201]);
      await page.goto("/app/web/ustanova/izvoz-podataka");
      for (const state of ["Čeka odobrenje", "Odobren", "Preuzet", "Istekao"]) await expect(page.getByText(state, { exact: true })).toBeVisible();
      await expect(page.getByText("Preuzet ili istekao: zahtjev je zatvoren", { exact: false })).toBeVisible();
      // One person records a request (the registry office), another approves it (the administrator).
      await expect(page.getByRole("region", { name: REQUEST_FORM })).toHaveCount(0);
      expect(seen.posts).toBe(0);
      expect(await serious(page)).toEqual([]);
    });

    test(`OA-6: the registry office records a request, and a second one for the same student is refused unsent (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const seen = await fakeExports(page, ["teacher"], [201]);
      await page.goto("/app/web/ustanova/izvoz-podataka");
      await expect(page.getByRole("region", { name: REQUEST_FORM })).toBeVisible();
      expect(await serious(page)).toEqual([]);

      await requestFor(page, STUDENT);
      await expect(page.getByText("Zahtjev je poslan. Izvoz će pokrenuti administrator ustanove.")).toBeVisible();
      expect(seen.posts).toBe(1);

      await requestFor(page, STUDENT.toUpperCase());
      await expect(page.locator("main").getByRole("alert")).toHaveText(WARNING);
      expect(seen.posts).toBe(1);
      // The registry office does not read the administrator's list.
      expect(seen.list).toBe(0);
      expect(await serious(page)).toEqual([]);
    });
  }
}

test("OA-6: the server's 409 is the same warning, and the student is then refused on the page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const seen = await fakeExports(page, ["teacher"], [409]);
  await page.goto("/app/web/ustanova/izvoz-podataka");
  await requestFor(page, STUDENT);
  await expect(page.locator("main").getByRole("alert")).toHaveText(WARNING);
  await requestFor(page, STUDENT);
  await expect(page.locator("main").getByRole("alert")).toHaveText(WARNING);
  expect(seen.posts).toBe(1);
  expect(await serious(page)).toEqual([]);
});
