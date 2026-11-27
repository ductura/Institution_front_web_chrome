// F4-STU-R11 (P-16, E-6c): when the teacher changed the notice, the student sees "Što se promijenilo (v1 → v2)"
// before confirming; without a previous version the notice is as before. Invented notice only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";
import { BLOCKING, WCAG_TAGS } from "./a11y/check";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a61";
const API = `**/api/v1/student/assignments/${ID}/notice`;
const TITLE = "Izmišljeni seminar o kompostiranju";
const notice = {
  assignmentId: ID, versionNo: 2, templateVersion: 1, title: TITLE,
  instructions: "Opišite izmišljeni pokus kompostiranja.",
  workType: "seminar_paper", opensAt: "2025-11-02T08:00:00.000Z", dueAt: "2099-12-15T22:59:00.000Z",
  aiPolicy: "partially_allowed", aiPurposes: ["proofreading", "literature_search"], evidenceProfile: "basic",
  wordMin: 1500, wordMax: 3000, readAt: null, acknowledgedAt: null,
};
const previousVersion = {
  versionNo: 1, title: TITLE, instructions: notice.instructions, workType: "seminar_paper", opensAt: notice.opensAt,
  dueAt: "2099-12-08T22:59:00.000Z", aiPolicy: "partially_allowed", aiPurposes: ["proofreading"],
  evidenceProfile: "basic", wordMin: 1200, wordMax: 2500,
};

async function openNotice(page: Page, body: object) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/v1/")) writes.push(request.url());
  });
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } },
  }));
  await page.route(API, (route) => route.fulfill({ json: body }));
  await page.goto(`/app/web/zadatak/${ID}`);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  return writes;
}

test("a changed notice shows the table of changes, passes axe and writes nothing on opening", async ({ page }) => {
  const writes = await openNotice(page, { ...notice, previousVersion });
  const table = page.getByRole("table", { name: "Što se promijenilo (v1 → v2)" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader")).toHaveText(["Stavka", "Bilo (v1)", "Sada (v2)"]);
  await expect(table.getByRole("rowheader")).toHaveText(["Rok", "Opseg riječi", "Pravilo uporabe alata"]);
  await expect(table.getByRole("row", { name: /Pravilo uporabe alata/ })).toContainText("pronalaženje znanstvene i stručne literature");
  await expect(page.getByRole("checkbox", { name: /Pročitao\/la sam obavijest/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.filter((v) => BLOCKING.includes(v.impact ?? ""))).toEqual([]);
  expect(writes).toEqual([]);
});

test("without a previous version the notice has no table of changes", async ({ page }) => {
  await openNotice(page, { ...notice, previousVersion: null });
  await expect(page.getByRole("checkbox", { name: /Pročitao\/la sam obavijest/ })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
