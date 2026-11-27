// NF-7 OA-2, OA-5, OA-9: /ustanova/postavke, /ustanova/postavke/asistent and /moja-prava over a fake institution server
// (page.route). All read only; invented data only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const ME = (role: string) => ({ role, displayName: "Ana Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } });
const RULES = { rules: [{ workType: "essay", versions: [{ versionNo: 1, aiPolicy: "partially_allowed", aiPurposes: ["formatting"], evidenceProfile: "basic", importAllowed: false, origin: "administrator", publishedAt: "2026-10-01T10:00:00.000Z" }] }] };

async function fake(page: Page, role: string, writes: string[]) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME(role) }));
  await page.route("**/api/v1/institution/faculty-rules", (route) => { if (route.request().method() !== "GET") writes.push(route.request().method()); return route.fulfill({ json: RULES }); });
  await page.route("**/api/v1/institution/origin-thresholds", (route) => route.fulfill({ json: { thresholds: [] } }));
  await page.route("**/api/v1/institution/retention", (route) => route.fulfill({ json: { classes: [{ key: "sessions", label: "retention.sessions", retentionDays: null, mode: "dry-run", candidates: null, lastRunAt: null }] } }));
  await page.route("**/api/v1/institution/assistant-setting", (route) => { if (route.request().method() !== "GET") writes.push(route.request().method()); return route.fulfill({ json: { assistant: false, transcription: false, tools: false, settingVersion: 1, changeable: false } }); });
  await page.route("**/api/v1/institution/thesis-forms", (route) => { if (route.request().method() !== "GET") writes.push(route.request().method()); return route.fulfill({ json: { forms: [{ code: "izjava-mentora", version: 2, title: "Izjava mentora", workTypes: ["bachelor_thesis", "master_thesis"], active: true, publishedAt: "2026-10-02T10:00:00.000Z" }] } }); });
  await page.route("**/api/v1/institution/thesis-settings", (route) => { if (route.request().method() !== "GET") writes.push(route.request().method()); return route.fulfill({ json: { mentorConsentRequired: true, changedAt: "2026-10-03T10:00:00.000Z" } }); });
}
const axe = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
};

for (const width of [390, 1280]) {
  test(`administrator: postavke fakulteta i asistent, samo čitanje, ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    await fake(page, "institution_admin", writes);
    await page.goto("/aplikacija/ustanova/postavke");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Postavke fakulteta");
    await expect(page.getByText("Rok još nije određen (čeka odluku)")).toBeVisible();
    await expect(page.getByText("Na snazi je 1 od 1 obrazaca.")).toBeVisible();
    await expect(page.getByText("Izjava mentora (izjava-mentora)", { exact: false })).toBeVisible();
    await expect(page.getByText("Suglasnost mentora potrebna je za predaju rada.")).toBeVisible();
    await axe(page);
    await page.getByRole("link", { name: "Asistent na fakultetu" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Asistent na fakultetu");
    await expect(page.getByText("Asistent je isključen")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(7);
    await expect(page.locator("main input, main select, main textarea")).toHaveCount(0);
    await axe(page);
    expect(writes).toEqual([]);
  });
}

test("student: „Moja prava” je statična uputa; nastavnik ne otvara postavke fakulteta", async ({ page }) => {
  const writes: string[] = [];
  await fake(page, "student", writes);
  await page.goto("/aplikacija/moja-prava");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moja prava");
  await expect(page.getByText("Ova uputa čeka pravni pregled.")).toBeVisible();
  await axe(page);
  await page.goto("/aplikacija/ustanova/postavke");
  await expect(page).not.toHaveURL(/ustanova\/postavke/);
});
