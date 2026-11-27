// WEB-1301 (A-05): /ustanova/cuvanje over a fake institution server (page.route).
// Two cards: the data classes (read only) and the legal holds (place, release with a
// reason). Holds come in the server's shape (LOK-WEB-4); a refused release of an own hold (403)
// shows the catalogue text. A 403 never shows a raw code. Invented data only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ME = (role: string) => ({ role, displayName: "Ana Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const ID1 = "b1301000-0000-4000-8000-000000000001";
const ID2 = "b1301000-0000-4000-8000-000000000002";
const STUDENT = "c1301000-0000-4000-8000-000000000001";
const PLACER = "d1301000-0000-4000-8000-000000000001";
const hold = (id: string, over: object = {}) => ({
  holdId: id, subjectType: "assignment", subjectId: `a1301000-0000-4000-8000-00000000000${id.slice(-1)}`,
  caseReference: `IZM-2026-00${id.slice(-1)}`, placedBy: PLACER, placedAt: "2026-11-20T09:00:00.000Z",
  releasedBy: null, releasedAt: null, ...over,
});
// The server's shape (LOK-WEB-3); the page names a class from its catalogue by `key`.
const CLASSES = { classes: [
  { key: "versions", label: "retention.versions", retentionDays: 365, mode: "execute", candidates: 12, lastRunAt: "2026-11-20T03:00:00.000Z" },
  { key: "access-log", label: "retention.accessLog", retentionDays: null, mode: "dry-run", candidates: 0, lastRunAt: null },
] };
const FORBIDDEN = { error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status: 403 };

type Fake = {
  holds: object[]; posts: unknown[]; releases: { id: string; body: unknown }[];
  postReply?: { status: number; body: unknown }; releaseReply?: { status: number; body: unknown };
};

async function fakeServer(page: Page, role: string, fake: Fake, denyReads = false) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(role) }));
  await page.route("**/api/v1/institution/retention", (route) =>
    denyReads ? route.fulfill({ status: 403, json: FORBIDDEN }) : route.fulfill({ json: CLASSES }));
  await page.route("**/api/v1/institution/legal-holds", async (route) => {
    if (route.request().method() === "POST") {
      fake.posts.push(JSON.parse(route.request().postData() ?? "null"));
      const reply = fake.postReply ?? { status: 201, body: { holdId: ID2 } };
      if (reply.status === 201) fake.holds.push(hold(ID2, { subjectType: "student", subjectId: STUDENT, caseReference: "IZM-2026-002" }));
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
      return;
    }
    if (denyReads) return route.fulfill({ status: 403, json: FORBIDDEN });
    await route.fulfill({ json: { holds: fake.holds } });
  });
  await page.route("**/api/v1/institution/legal-holds/*/release", async (route) => {
    const id = route.request().url().split("/").at(-2)!;
    fake.releases.push({ id, body: JSON.parse(route.request().postData() ?? "null") });
    if (fake.releaseReply) return route.fulfill({ status: fake.releaseReply.status, json: fake.releaseReply.body });
    fake.holds = fake.holds.filter((h) => (h as { holdId: string }).holdId !== id);
    await route.fulfill({ json: { holdId: id, releasedAt: "2026-11-21T10:00:00.000Z" } });
  });
}
const fresh = (): Fake => ({ holds: [hold(ID1)], posts: [], releases: [] });
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");

test("the data classes card shows period and mode, with no deleting control", async ({ page }) => {
  await fakeServer(page, "institution_admin", fresh());
  await page.goto("/aplikacija/ustanova/cuvanje");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Čuvanje podataka");
  const table = page.getByRole("table", { name: /Klase podataka, rokovi i način čuvanja/ });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row", { name: /Verzije rada/ })).toContainText("365 dana");
  await expect(table.getByRole("row", { name: /Verzije rada/ })).toContainText("Briše se");
  await expect(table.getByRole("row", { name: /Zapis pristupa/ })).toContainText("Rok još nije određen");
  await expect(table.getByRole("row", { name: /Zapis pristupa/ })).toContainText("Probni prolaz");
  await expect(table.locator("button, input, select, textarea")).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});

test("a hold is placed with the keyboard on a typed subject", async ({ page }) => {
  const fake = fresh();
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/aplikacija/ustanova/cuvanje");
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "IZM-2026-001" })).toContainText("Zadatak: a1301000-0000-4000-8000-000000000001");
  await expect(page.getByText(PLACER)).toHaveCount(0);

  await page.getByLabel("Vrsta predmeta").selectOption("student");
  await page.getByLabel("Oznaka predmeta").fill(STUDENT);
  await page.getByLabel("Referenca slučaja").fill("IZM-2026-002");
  await page.getByLabel("Referenca slučaja").press("Enter");
  await expect(page.getByText("Zadržavanje je postavljeno.")).toBeVisible();
  expect(fake.posts).toEqual([{ subjectType: "student", subjectId: STUDENT, caseReference: "IZM-2026-002" }]);
  await expect(page.getByRole("listitem").filter({ hasText: "IZM-2026-002" })).toContainText(`Student: ${STUDENT}`);
  expect(await serious(page)).toEqual([]);
});

test("a refused release of an own hold (403) shows the catalogue text", async ({ page }) => {
  const fake: Fake = { ...fresh(), releaseReply: { status: 403, body: FORBIDDEN } };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/aplikacija/ustanova/cuvanje");
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await page.getByRole("button", { name: "Skini zadržavanje" }).click();
  await page.getByLabel("Razlog skidanja").fill("Izmišljeni slučaj je zatvoren.");
  await page.getByRole("button", { name: "Skini zadržavanje" }).last().click();
  await expect(page.getByRole("alert").filter({ hasText: "Zadržavanje koje ste sami postavili" })).toBeVisible();
  await expect(page.getByText("Zadržavanje je skinuto.")).toHaveCount(0);
});

test("another administrator's hold is released with a reason", async ({ page }) => {
  const fake = fresh();
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/aplikacija/ustanova/cuvanje");
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
  await page.goto("/aplikacija/ustanova/cuvanje");
  await expect(page.getByRole("alert").filter({ hasText: "administrator ustanove" })).toHaveCount(1);
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "administrator ustanove" })).toBeVisible();
  await expect(page.getByText("forbidden")).toHaveCount(0);
});

test("a refused placing (403) shows the catalogue text under the form", async ({ page }) => {
  const fake: Fake = { ...fresh(), postReply: { status: 403, body: FORBIDDEN } };
  await fakeServer(page, "institution_admin", fake);
  await page.goto("/aplikacija/ustanova/cuvanje");
  await page.getByRole("tab", { name: "Pravna zadržavanja" }).click();
  await page.getByLabel("Vrsta predmeta").selectOption("work");
  await page.getByLabel("Oznaka predmeta").fill("rad-izm-3");
  await page.getByLabel("Referenca slučaja").fill("IZM-2026-003");
  await page.getByRole("button", { name: "Postavi zadržavanje" }).last().click();
  await expect(page.getByRole("alert").filter({ hasText: "administrator ustanove" })).toBeVisible();
  await expect(page.getByText("Zadržavanje je postavljeno.")).toHaveCount(0);
});

test("a teacher does not see the cards", async ({ page }) => {
  await fakeServer(page, "teacher", fresh());
  await page.goto("/aplikacija/ustanova/cuvanje");
  await expect(page.getByRole("table", { name: /Klase podataka/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Pravna zadržavanja" })).toHaveCount(0);
});
