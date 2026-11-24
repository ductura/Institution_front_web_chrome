// NF-7 OA-3, OA-6, OA-7 over a fake institution server (page.route); invented data only.
// OA-3 "Dnevnik radnji" and OA-7 "Prijave problema" have no read in the contract extract yet, so the
// pages show the honest "not yet available" state and read nothing. OA-6: the export requests show
// their state in words, and a second request for the same student is refused (on the page and on 409).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ME = (roles: string[]) => ({ roles, displayName: "Operater A", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const STUDENT = "0b6d6f1e-3c1a-4f7e-9a51-2f4a7d3c9e10";
const EXPORTS = {
  exports: [
    { exportId: "11111111-1111-4111-8111-111111111111", state: "requested", requestedAt: "2026-11-20T09:00:00.000Z", expiresAt: null },
    { exportId: "22222222-2222-4222-8222-222222222222", state: "approved", requestedAt: "2026-11-14T09:00:00.000Z", expiresAt: null },
    { exportId: "33333333-3333-4333-8333-333333333333", state: "downloaded", requestedAt: "2026-11-10T09:00:00.000Z", expiresAt: "2026-11-17T09:00:00.000Z" },
    { exportId: "44444444-4444-4444-8444-444444444444", state: "expired", requestedAt: "2026-10-28T09:00:00.000Z", expiresAt: "2026-11-04T09:00:00.000Z" },
  ],
};

/** The session of `roles`; every other /api/v1 call is counted, so a page that must read nothing can be checked. */
async function fakeServer(page: Page, roles: string[]) {
  const seen: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/api/v1/me")) return route.fulfill({ json: ME(roles) });
    seen.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 404, json: { error: "not_found" } });
  });
  return seen;
}
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical");

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`OA-3, OA-7: the operator reaches both pages from its home; honest state, nothing read (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const seen = await fakeServer(page, ["network_engineer"]);
      await page.goto("/app/web/operater/mjerila-pilota");
      await page.getByRole("link", { name: "Dnevnik radnji" }).click();
      await expect(page).toHaveURL(/\/operater\/dnevnik-radnji$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dnevnik radnji");
      await expect(page.getByText("Dnevnik radnji još nije dostupan")).toBeVisible();
      await expect(page.getByRole("table", { name: "Vrste radnji u dnevniku" }).getByRole("row")).toHaveCount(6);
      expect(await serious(page)).toEqual([]);

      await page.goto("/app/web/operater/mjerila-pilota");
      await page.getByRole("link", { name: "Prijave problema" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prijave problema");
      await expect(page.getByText("Popis prijava još nije dostupan")).toBeVisible();
      const routing = page.getByRole("table", { name: "Usmjeravanje prijava po kategoriji" });
      await expect(routing.getByRole("row", { name: /Tehnički problem/ })).toContainText("operater vaša");
      await expect(routing.getByRole("row", { name: /Račun i uloge/ })).not.toContainText("vaša");
      expect(await serious(page)).toEqual([]);
      expect(seen.filter((call) => !call.endsWith("/ops/pilot-metrics"))).toEqual([]);
    });
  }
}

test("OA-3, OA-7: the administrator opens both pages and sees its own category; a teacher is refused", async ({ page }) => {
  const seen = await fakeServer(page, ["institution_admin"]);
  await page.goto("/app/web/operater/prijave-problema");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prijave problema");
  await expect(page.getByRole("table", { name: "Usmjeravanje prijava po kategoriji" }).getByRole("row", { name: /Račun i uloge/ }))
    .toContainText("administrator fakulteta vaša");
  await page.goto("/app/web/operater/dnevnik-radnji");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dnevnik radnji");
  expect(seen).toEqual([]);

  await page.unrouteAll();
  await fakeServer(page, ["teacher"]);
  await page.goto("/app/web/operater/dnevnik-radnji");
  await expect(page).toHaveURL(/nema-ovlasti/);
});

/** The export routes: the list as given, and the request's answers in turn (the last one repeats). */
async function fakeExports(page: Page, replies: number[]) {
  const seen = { list: 0, posts: 0 };
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(["institution_admin"]) }));
  await page.route("**/api/v1/institution/student-data-exports", (route) => {
    if (route.request().method() === "GET") { seen.list += 1; return route.fulfill({ json: EXPORTS }); }
    const status = replies[Math.min(seen.posts, replies.length - 1)] ?? 201;
    seen.posts += 1;
    return status === 201
      ? route.fulfill({ status, json: { exportId: "55555555-5555-4555-8555-555555555555" } })
      : route.fulfill({ status, json: { error: "conflict" } });
  });
  return seen;
}

async function requestFor(page: Page, studentId: string) {
  const form = page.getByRole("region", { name: "Zahtjev za izvoz podataka studenta" });
  await form.getByLabel("Oznaka studenta").fill(studentId);
  await form.getByLabel("Isprava kojom je provjeren identitet").selectOption("student_card");
  await form.getByLabel("Provjerio/la sam identitet studenta uživo").check();
  await form.getByLabel("Oznaka provjere").fill("Spis 12/2026");
  // Keyboard: the request is sent with Enter from the last field.
  await form.getByLabel("Oznaka provjere").press("Enter");
}

for (const width of [390, 1280]) {
  test(`OA-6: states in words, a recorded request re-reads the list, a second one is refused unsent (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const seen = await fakeExports(page, [201]);
    await page.goto("/app/web/ustanova/izvoz-podataka");
    for (const state of ["Čeka odobrenje", "Odobren", "Preuzet", "Istekao"]) await expect(page.getByText(state, { exact: true })).toBeVisible();
    await expect(page.getByText("Preuzet ili istekao: zahtjev je zatvoren", { exact: false })).toBeVisible();
    expect(await serious(page)).toEqual([]);

    await requestFor(page, STUDENT);
    await expect(page.getByText("Zahtjev je zabilježen i dodan na popis.")).toBeVisible();
    await expect.poll(() => seen.list).toBe(2);

    await requestFor(page, STUDENT.toUpperCase());
    await expect(page.getByRole("alert")).toHaveText("Za ovog studenta već postoji otvoren zahtjev za izvoz. Novi zahtjev nije zabilježen.");
    expect(seen.posts).toBe(1);
    expect(await serious(page)).toEqual([]);
  });
}

test("OA-6: the server's 409 is the same warning, and the student is then refused on the page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const seen = await fakeExports(page, [409]);
  await page.goto("/app/web/ustanova/izvoz-podataka");
  await requestFor(page, STUDENT);
  await expect(page.getByRole("alert")).toHaveText("Za ovog studenta već postoji otvoren zahtjev za izvoz. Novi zahtjev nije zabilježen.");
  await requestFor(page, STUDENT);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(seen.posts).toBe(1);
  expect(seen.list).toBe(1);
  expect(await serious(page)).toEqual([]);
});
