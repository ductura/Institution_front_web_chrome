// WEB-1301 (A-05): /ustanova/cuvanje over a fake institution server (page.route).
// Two cards: the data classes (read only) and the legal holds (place, release with a
// reason, own hold inert). A 403 shows the catalogue text, never a raw code. Invented data only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ME = (role: string) => ({ role, displayName: "Ana Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const ID1 = "b1301000-0000-4000-8000-000000000001";
const ID2 = "b1301000-0000-4000-8000-000000000002";
const hold = (id: string, over: object = {}) => ({
  id, subject: `Izmišljeni predmet ${id.slice(-1)}`, caseReference: `IZM-2026-00${id.slice(-1)}`,
  placedAt: "2026-11-20T09:00:00.000Z", placedByName: "Ana Izmišljena", own: false, ...over,
});
const CLASSES = { classes: [
  { classId: "DATA-CLASS-01", name: "Izmišljeni radni tekst", retentionDays: 365, mode: "delete" },
  { classId: "DATA-CLASS-02", name: "Izmišljeni zapis pristupa", retentionDays: null, mode: "dry_run" },
] };
const FORBIDDEN = { error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status: 403 };

type Fake = { holds: object[]; posts: unknown[]; releases: { id: string; body: unknown }[]; postReply?: { status: number; body: unknown } };

async function fakeServer(page: Page, role: string, fake: Fake, denyReads = false) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(role) }));
  await page.route("**/api/v1/institution/retention", (route) =>
    denyReads ? route.fulfill({ status: 403, json: FORBIDDEN }) : route.fulfill({ json: CLASSES }));
  await page.route("**/api/v1/institution/legal-holds", async (route) => {
    if (route.request().method() === "POST") {
      fake.posts.push(JSON.parse(route.request().postData() ?? "null"));
      const reply = fake.postReply ?? { status: 201, body: { id: ID2 } };
      if (reply.status === 201) fake.holds.push(hold(ID2));
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
      return;
    }
    if (denyReads) return route.fulfill({ status: 403, json: FORBIDDEN });
    await route.fulfill({ json: { holds: fake.holds } });
  });
  await page.route("**/api/v1/institution/legal-holds/*/release", async (route) => {
    const id = route.request().url().split("/").at(-2)!;
    fake.releases.push({ id, body: JSON.parse(route.request().postData() ?? "null") });
    fake.holds = fake.holds.filter((h) => (h as { id: string }).id !== id);
    await route.fulfill({ json: { id, releasedAt: "2026-11-21T10:00:00.000Z" } });
  });
}
const fresh = (): Fake => ({ holds: [hold(ID1, { own: true })], posts: [], releases: [] });
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");

test("the data classes card shows period and mode, with no deleting control", async ({ page }) => {
  await fakeServer(page, "institution_admin", fresh());
  await page.goto("/app/web/ustanova/cuvanje");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Čuvanje podataka");
  const table = page.getByRole("table", { name: /Klase podataka, rokovi i način čuvanja/ });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row", { name: /Izmišljeni radni tekst/ })).toContainText("365 dana");
  await expect(table.getByRole("row", { name: /Izmišljeni radni tekst/ })).toContainText("Briše se");
  await expect(table.getByRole("row", { name: /Izmišljeni zapis pristupa/ })).toContainText("Rok još nije određen");
  await expect(table.getByRole("row", { name: /Izmišljeni zapis pristupa/ })).toContainText("Probni prolaz");
  await expect(table.locator("button, input, select, textarea")).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});

test("a hold is placed with the keyboard, and the own hold cannot be released", async ({ page }) => {
  const fake = fresh();
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/app/web/ustanova/cuvanje");
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  const own = page.getByRole("button", { name: "Skini zadržavanje" });
  await expect(own).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText(/Zadržavanje koje ste sami postavili/)).toBeVisible();

  await page.getByLabel("Predmet").fill("Izmišljeni kolegij za test");
  await page.getByLabel("Referenca slučaja").fill("IZM-2026-002");
  await page.getByLabel("Referenca slučaja").press("Enter");
  await expect(page.getByText("Zadržavanje je postavljeno.")).toBeVisible();
  expect(fake.posts).toEqual([{ subject: "Izmišljeni kolegij za test", caseReference: "IZM-2026-002" }]);
  await expect(page.getByRole("listitem").filter({ hasText: "IZM-2026-002" })).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("another administrator's hold is released with a reason", async ({ page }) => {
  const fake: Fake = { holds: [hold(ID1, { placedByName: "Ivan Izmišljeni" })], posts: [], releases: [] };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/app/web/ustanova/cuvanje");
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await page.getByRole("button", { name: "Skini zadržavanje" }).click();
  await page.getByRole("button", { name: "Skini zadržavanje" }).last().click();
  await expect(page.getByText("Upišite razlog skidanja.")).toBeVisible();
  expect(fake.releases).toEqual([]);
  await page.getByLabel("Razlog skidanja").fill("Izmišljeni slučaj je zatvoren.");
  await page.getByRole("button", { name: "Skini zadržavanje" }).last().click();
  await expect(page.getByText("Zadržavanje je skinuto.")).toBeVisible();
  expect(fake.releases).toEqual([{ id: ID1, body: { reason: "Izmišljeni slučaj je zatvoren." } }]);
  await expect(page.getByText("Nema aktivnih pravnih zadržavanja.")).toBeVisible();
});

test("a 403 shows the catalogue text, not the raw code", async ({ page }) => {
  await fakeServer(page, "institution_admin", fresh(), true);
  await page.goto("/app/web/ustanova/cuvanje");
  await expect(page.getByRole("alert").filter({ hasText: "administrator ustanove" })).toHaveCount(1);
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "administrator ustanove" })).toBeVisible();
  await expect(page.getByText("forbidden")).toHaveCount(0);
});

test("a refused placing (403) shows the catalogue text under the form", async ({ page }) => {
  const fake: Fake = { ...fresh(), postReply: { status: 403, body: FORBIDDEN } };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/app/web/ustanova/cuvanje");
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await page.getByLabel("Predmet").fill("Izmišljeni kolegij za test");
  await page.getByLabel("Referenca slučaja").fill("IZM-2026-003");
  await page.getByRole("button", { name: "Postavi zadržavanje" }).last().click();
  await expect(page.getByRole("alert").filter({ hasText: "administrator ustanove" })).toBeVisible();
  await expect(page.getByText("Zadržavanje je postavljeno.")).toHaveCount(0);
});

test("a teacher does not see the cards", async ({ page }) => {
  await fakeServer(page, "teacher", fresh());
  await page.goto("/app/web/ustanova/cuvanje");
  await expect(page.getByRole("table", { name: /Klase podataka/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Pravna zadržavanja" })).toHaveCount(0);
});
