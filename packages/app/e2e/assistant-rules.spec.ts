// ED-09 (NF2-P9): "Pravila za ovaj zadatak" under the Asistent card and the assignment's instructions in
// "Prije prve rečenice". Invented assignment, invented server: the notice route answers with the policy.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c59";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d49";
const SCOPE = "d".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0009";
const PATH = `/app/web/rad/${ID}`;
const INSTRUCTIONS = "Opišite izmišljeni gradski vrt i navedite tri izvora.";

const noticeBody = (over: Record<string, unknown> = {}) => ({
  assignmentId: ID, versionNo: 1, templateVersion: 1, title: "Izmišljeni seminar o gradskim vrtovima",
  instructions: INSTRUCTIONS, workType: "seminar_paper", opensAt: "2025-11-02T08:00:00.000Z",
  dueAt: "2099-12-15T22:59:00.000Z", aiPolicy: "partially_allowed",
  aiPurposes: ["formatting", "proofreading", "literature_search", "translation"], evidenceProfile: "basic",
  wordMin: 1500, wordMax: 3000, readAt: null, acknowledgedAt: "2025-11-03T09:20:00.000Z", ...over,
});

async function server(page: Page, notice: { status?: number; json?: unknown }) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o gradskim vrtovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route(`**/api/v1/student/assignments/${ID}/notice`, (route) =>
    notice.status ? route.fulfill({ status: notice.status, json: {} }) : route.fulfill({ json: notice.json }));
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

async function openRules(page: Page, notice: { status?: number; json?: unknown } = { json: noticeBody() }) {
  await server(page, notice);
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  await skipGuide(page);
  if ((page.viewportSize()?.width ?? 1280) <= 640) {
    const drawer = page.getByRole("button", { name: "Bočni panel" });
    await drawer.focus();
    await page.keyboard.press("Enter");
  }
  const tab = page.getByRole("tab", { name: "Asistent" });
  await tab.focus();
  await page.keyboard.press("Enter");
  const rules = page.locator("[data-assistant-rules]");
  await expect(rules).toBeVisible({ timeout: 15_000 });
  return rules;
}

test.describe("ED-09 Pravila za ovaj zadatak", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("lists the purposes of the notice with a spoken word for each", async ({ page }) => {
    const rules = await openRules(page);
    await expect(rules.getByRole("heading", { name: "Pravila za ovaj zadatak" })).toBeVisible();
    await expect(rules.getByText("Alati su djelomično dopušteni.")).toBeVisible();
    await expect(rules.getByRole("listitem")).toHaveCount(5);
    await expect(rules.getByRole("listitem").filter({ hasText: "transkripcija" })).toContainText("nije dopušteno");
    await expect(rules.getByRole("listitem").filter({ hasText: "prijevod" })).toContainText("· dopušteno");
    await expect(rules.getByText("Alate koje koristite izvan Ducture navedite u izjavi pri predaji.")).toBeVisible();
  });

  test("prohibited says no purpose is allowed", async ({ page }) => {
    const rules = await openRules(page, { json: noticeBody({ aiPolicy: "prohibited", aiPurposes: [] }) });
    await expect(rules.getByText("Alati nisu dopušteni.")).toBeVisible();
    await expect(rules.getByText("Nijedna svrha nije dopuštena.")).toBeVisible();
    await expect(rules.getByRole("listitem")).toHaveCount(0);
  });

  test("an unreadable notice is said honestly, the ways out stay", async ({ page }) => {
    const rules = await openRules(page, { status: 503 });
    await expect(rules.getByText("Pravila zadatka trenutačno se ne mogu učitati.", { exact: false })).toBeVisible();
    await expect(rules.getByRole("link", { name: "Pročitaj obavijest zadatka" })).toBeVisible();
  });

  test("the links lead to the notice and to the declaration", async ({ page }) => {
    const rules = await openRules(page);
    await expect(rules.getByRole("link", { name: "Pročitaj obavijest zadatka" })).toHaveAttribute("href", `/app/web/zadatak/${ID}`);
    await expect(rules.getByRole("link", { name: "Izjava o korištenju alata" })).toHaveAttribute("href", `/app/web/rad/${ID}/predaja/izjava`);
  });

  test("Prije prve rečenice shows the assignment's instructions", async ({ page }) => {
    await server(page, { json: noticeBody() });
    await page.goto(PATH);
    await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
    await skipGuide(page);
    await page.getByRole("button", { name: "Pomoć" }).first().click();
    await page.getByRole("menuitem", { name: "Prije prve rečenice" }).click();
    await expect(page.getByRole("dialog")).toContainText(INSTRUCTIONS);
  });

  test("keyboard reaches both links", async ({ page }) => {
    const rules = await openRules(page);
    const link = rules.getByRole("link", { name: "Pročitaj obavijest zadatka" });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rules.getByRole("link", { name: "Izjava o korištenju alata" })).toBeFocused();
    expect(await hiddenFocus(page)).toEqual([]);
  });

  for (const width of [390, 1280]) {
    for (const theme of ["dark", "light"] as const) {
      test(`axe ${width} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openRules(page);
        await setTheme(page, theme);
        await axe(page, test.info(), `ed09-pravila-${width}-${theme}`);
      });
    }
  }
});
