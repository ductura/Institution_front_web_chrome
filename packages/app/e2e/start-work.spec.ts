// WEB-1402 (plan M2.1), ED-01a: "Započni rad" on the assignment card, with an invented /api/v1 that
// keeps the server's rule: one work per student and assignment, made by the first call.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

import { startWorkText as s } from "../src/host/student/start-work/messages.hr";

const ID = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e5f7";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1f";
const WORK = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
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
    if (!started) { started = true; seen.made += 1; }
    // The shape of student-work.start.post: always 200, the same work to every call.
    return route.fulfill({ status: 200, json: { workId: WORK, rulesVersion: 3, language: "hr" } });
  });
  return seen;
}

/** STU-R07: the home row has one button, "Otvori zadatak"; "Započni rad" is on the task page it opens. */
async function openTask(page: Page) {
  await page.goto("/aplikacija/zadaci");
  await expect(page.getByRole("button", { name: s.startFor.replace("{title}", TITLE) })).toHaveCount(0);
  await page.getByRole("link", { name: /^Otvori zadatak/ }).click();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
}

const startButton = (page: Page) => page.getByRole("button", { name: s.startFor.replace("{title}", TITLE) });

test("the student starts the work, refreshes, and the work is there; the row then opens the same work", async ({ page }) => {
  const seen = await server(page);
  await openTask(page);
  await expect(startButton(page)).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
  expect(seen.starts).toBe(0);

  await startButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
  await expect(page.getByText(TITLE).first()).toBeVisible();
  await expect(page.getByText("Rad još nije započet.")).toHaveCount(0);
  expect(seen).toEqual({ starts: 1, made: 1 });

  // INT-31: a started work no longer offers "Započni rad"; its row opens the same work without a new start.
  await page.goto("/aplikacija/zadaci");
  await page.getByRole("link", { name: "Otvori rad" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
  await expect(startButton(page)).toHaveCount(0);
  expect(seen).toEqual({ starts: 1, made: 1 });
});

test("a double click makes one work and sends one request", async ({ page }) => {
  const seen = await server(page, { startDelayMs: 400 });
  await openTask(page);
  await startButton(page).dblclick();
  // The task page reads again in place; the work exists once the start button is gone.
  await expect(startButton(page)).toHaveCount(0);
  expect(seen).toEqual({ starts: 1, made: 1 });
});

// The line "Rad je otvoren. Jezik rada: hrvatski. Pravila fakulteta: verzija 3." belonged to the list card, which went
// to the editor; the task page reads in place, and that text is held by StartWork.dom.test.ts ("Jezik rada: hrvatski").
test("after the start the task page leaves the empty state in place, with no second start", async ({ page }) => {
  const seen = await server(page);
  await openTask(page);
  await expect(page.getByText("Rad još nije započet.")).toBeVisible();
  await startButton(page).click();
  await expect(page.getByText("Rad još nije započet.")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
  expect(seen).toEqual({ starts: 1, made: 1 });
});

test("a 404 leads to the no-access screen of WEB-1401, which does not say whether the assignment exists", async ({ page }) => {
  await server(page);
  await page.route(START, (route) => route.fulfill({ status: 404, json: { code: "not_found" } }));
  await openTask(page);
  await startButton(page).click();
  await expect(page).toHaveURL(/\/aplikacija\/nema-ovlasti\?kind=denied&returnTo=%2Fzadaci$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nemate ovlasti za ovaj prikaz");
});

test("a 409 conflict (notice not acknowledged or not open yet) leads to the assignment, not to an unknown note", async ({ page }) => {
  await server(page);
  await page.route(START, (route) => route.fulfill({ status: 409, json: { code: "conflict" } }));
  await openTask(page);
  await startButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/zadatak/${ID}$`));
  await expect(page.getByText(s.unknown)).toHaveCount(0);
});

test("an unknown answer stays on the card with a note, and the next click opens the work", async ({ page }) => {
  const seen = await server(page);
  let failOnce = true;
  await page.route(START, async (route) => {
    if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { code: "unavailable" } }); }
    return route.fallback();
  });
  await openTask(page);
  await startButton(page).click();
  await expect(page.getByRole("alert").filter({ hasText: s.unknown })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
  await startButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/rad/${ID}$`));
  expect(seen).toEqual({ starts: 1, made: 1 });
});
