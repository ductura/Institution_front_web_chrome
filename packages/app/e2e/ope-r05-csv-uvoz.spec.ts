// F4-OPE-R05 (OPE-10): the administrator imports a CSV roster at /ustanova/isvu over a fake institution server
// (page.route): preview first, nothing enrolled until the confirmation, a refused list and a foreign course say so.
// axe on the page with a preview open. Invented people only.
import AxeBuilder from "@axe-core/playwright";

import { BLOCKING, WCAG_TAGS } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";

const COURSE = "5b1f2c3d-0000-4000-8000-000000000001";
const IMPORT = "5b1f2c3d-0000-4000-8000-000000000002";
const ME = { role: "institution_admin", displayName: "Ana Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" } };
const CSV = "identifier,givenName,familyName\nnovi@aai-test.hr,Nina,Izmišljenić\nnepoznat@aai-test.hr,Ivo,Izmišljenić\n";
const row = (line: number, identifier: string, status: string, reason: string | null) => ({ line, identifier, givenName: "Ime", familyName: `Prezime${line}`, status, reason });
const PREVIEW = {
  importId: IMPORT, source: "merlin", expiresAt: "2099-01-01T10:00:00.000Z", counts: { new: 1, alreadyEnrolled: 0, unsuitable: 1 },
  rows: [row(2, "novi@aai-test.hr", "new", null), row(3, "nepoznat@aai-test.hr", "unsuitable", "unknown_account")],
};

type Fake = { previews: { source: string; csv: string }[]; confirms: string[]; preview: { status: number; body: unknown } };

async function fakeServer(page: Page, fake: Fake) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME }));
  await page.route("**/api/v1/institution/admin/academic-years", (route) => route.fulfill({ json: { years: ["2026/2027"] } }));
  await page.route("**/api/v1/institution/admin/courses*", (route) => route.fulfill({
    json: { academicYear: "2026/2027", courses: [{ courseId: COURSE, name: "Izmišljeni kolegij", students: 0, holder: null, team: [], groups: [] }] },
  }));
  await page.route("**/api/v1/institution/admin/isvu/courses*", (route) => route.fulfill({ json: { mode: "mock", courses: [] } }));
  await page.route(`**/api/v1/institution/admin/courses/${COURSE}/roster-imports`, (route) => {
    fake.previews.push(JSON.parse(route.request().postData() ?? "null"));
    return route.fulfill({ status: fake.preview.status, contentType: "application/json", body: JSON.stringify(fake.preview.body) });
  });
  await page.route(`**/api/v1/institution/admin/roster-imports/${IMPORT}/confirm`, (route) => {
    fake.confirms.push(IMPORT);
    return route.fulfill({ json: { enrolled: 1, alreadyEnrolled: 0, skipped: 1, alreadyConfirmed: false } });
  });
}

async function openAndFill(page: Page) {
  await page.goto("/aplikacija/ustanova/isvu");
  const panel = page.getByRole("region", { name: "Uvoz popisa iz CSV-a" });
  await panel.getByLabel("Kolegij u Ducturi").selectOption(COURSE);
  await panel.getByLabel("Vrsta izvoza").selectOption("merlin");
  await panel.getByLabel("CSV popis").fill(CSV);
  return panel;
}

test("the preview enrols nobody; the confirmation does, once", async ({ page }) => {
  const fake: Fake = { previews: [], confirms: [], preview: { status: 200, body: PREVIEW } };
  await fakeServer(page, fake);
  const panel = await openAndFill(page);
  expect(fake.previews).toHaveLength(0);

  await panel.getByRole("button", { name: "Pregledaj CSV" }).click();
  await expect(panel.getByRole("table", { name: "Retci CSV popisa" }).getByRole("row")).toHaveCount(3);
  await expect(panel.getByText("Student se još nije prijavio kroz AAI@EduHr, pa račun ne postoji.")).toBeVisible();
  expect(fake.previews).toEqual([{ source: "merlin", csv: CSV }]);
  expect(fake.confirms).toHaveLength(0);

  await panel.getByRole("button", { name: "Potvrdi upis…" }).click();
  expect(fake.confirms).toHaveLength(0); // the dialog alone enrols nobody
  await page.getByRole("dialog").getByRole("button", { name: "Potvrdi upis", exact: true }).click();
  await expect(panel.getByText("Upisano: 1")).toBeVisible();
  expect(fake.confirms).toEqual([IMPORT]);

  const violations = (await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations.filter((v) => BLOCKING.includes(v.impact ?? ""));
  expect(violations.map((v) => v.id)).toEqual([]);
});

test("a list the server refuses (422) shows why and no table", async ({ page }) => {
  const fake: Fake = { previews: [], confirms: [], preview: { status: 422, body: { error: "roster_columns_missing" } } };
  await fakeServer(page, fake);
  const panel = await openAndFill(page);
  await panel.getByRole("button", { name: "Pregledaj CSV" }).click();
  await expect(panel.getByText("U popisu nedostaju obavezni stupci.")).toBeVisible();
  await expect(panel.getByRole("table")).toHaveCount(0);
  expect(fake.confirms).toHaveLength(0);
});

test("a foreign course (404) is not shown as an empty list", async ({ page }) => {
  const fake: Fake = { previews: [], confirms: [], preview: { status: 404, body: { error: "not_found" } } };
  await fakeServer(page, fake);
  const panel = await openAndFill(page);
  await panel.getByRole("button", { name: "Pregledaj CSV" }).click();
  await expect(panel.getByText("Kolegij nije dostupan u ovoj ustanovi.")).toBeVisible();
  await expect(panel.getByRole("table")).toHaveCount(0);
  await expect(panel.getByText("Nema novih studenata za upis.")).toHaveCount(0);
});
