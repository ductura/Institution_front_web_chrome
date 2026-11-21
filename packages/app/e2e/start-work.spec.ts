// WEB-1402 (plan M2.1): "Započni rad" on the assignment card, with an invented /api/v1 that
// keeps the server's rule: one work per student and assignment, made by the first call.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { startWorkText as s } from "../src/host/student/start-work/messages.hr";

const ID = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e5f7";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1f";
const DOCUMENT = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const TITLE = "Izmišljeni seminar o gradskim vrtovima";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const START = `**/api/v1/assignments/${ID}/start`;

/** The invented server: the work exists only after the first start, and every start answers the same work. */
async function server(page: Page, options: { startDelayMs?: number } = {}) {
  const seen = { starts: 0, made: 0 };
  let started = false;
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: TITLE, dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: started ? "in_progress" : "not_started" }] },
  }));
  await page.route(START, async (route) => {
    seen.starts += 1;
    expect(route.request().method()).toBe("POST");
    if (options.startDelayMs) await new Promise((resolve) => setTimeout(resolve, options.startDelayMs));
    const created = !started;
    if (created) { started = true; seen.made += 1; }
    return route.fulfill({
      status: created ? 201 : 200,
      json: { assignmentId: ID, documentId: DOCUMENT, created, workLanguage: "hr", facultyRulesVersion: 3 },
    });
  });
  return seen;
}

const startButton = (page: Page) => page.getByRole("button", { name: s.startFor.replace("{title}", TITLE) });

test("the student starts the work, refreshes, and the work is there; a second click opens the same work", async ({ page }) => {
  const seen = await server(page);
  await page.goto("/app/web/zadaci");
  await expect(startButton(page)).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
  expect(seen.starts).toBe(0);

  await startButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}$`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}$`));
  await expect(page.getByText(TITLE).first()).toBeVisible();
  await expect(page.getByText("Rad još nije započet.")).toHaveCount(0);
  expect(seen).toEqual({ starts: 1, made: 1 });

  await page.goto("/app/web/zadaci");
  await startButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}$`));
  expect(seen).toEqual({ starts: 2, made: 1 });
});

test("a double click makes one work and sends one request", async ({ page }) => {
  const seen = await server(page, { startDelayMs: 400 });
  await page.goto("/app/web/zadaci");
  await startButton(page).dblclick();
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}$`));
  expect(seen).toEqual({ starts: 1, made: 1 });
});

test("the card names the language of the work and the version of the faculty rules while the editor opens", async ({ page }) => {
  await server(page);
  await page.goto("/app/web/zadaci");
  // Hold the editor's route so the card stays in view after the answer.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/app/web/rad/${ID}**`, async (route) => { await held; await route.continue(); });
  await startButton(page).click();
  await expect(page.getByRole("status").filter({ hasText: s.opened })).toHaveText(
"Rad je otvoren. Jezik rada: hrvatski. Pravila fakulteta: verzija 3.");
  release();
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}$`));
});

test("a 404 leads to the no-access screen of WEB-1401, which does not say whether the assignment exists", async ({ page }) => {
  await server(page);
  await page.route(START, (route) => route.fulfill({ status: 404, json: { code: "not_found" } }));
  await page.goto("/app/web/zadaci");
  await startButton(page).click();
  await expect(page).toHaveURL(/\/app\/web\/nema-ovlasti\?kind=denied&returnTo=%2Fzadaci$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nemate ovlasti za ovaj prikaz");
});

test("an unknown answer stays on the card with a note, and the next click opens the work", async ({ page }) => {
  const seen = await server(page);
  let failOnce = true;
  await page.route(START, async (route) => {
    if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { code: "unavailable" } }); }
    return route.fallback();
  });
  await page.goto("/app/web/zadaci");
  await startButton(page).click();
  await expect(page.getByRole("alert").filter({ hasText: s.unknown })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/web\/zadaci$/);
  await startButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/web/rad/${ID}$`));
  expect(seen).toEqual({ starts: 1, made: 1 });
});
