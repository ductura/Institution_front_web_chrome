import { expect, test, type Page } from "./fixtures/test";

// HOST-S2: the submission steps in the host, with an invented /api/v1.
const ID = "5d1e2f30-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const COURSE = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const PATH = `/rad/${ID}/predaja`;

async function student(page: Page, workState: "not_started" | "in_progress" | "submitted", noticeFirst = false) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni esej o pčelarstvu", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState }] },
  }));
}

test("a work not yet submitted opens on the declaration under the same base", async ({ page }) => {
  await student(page, "in_progress");
  await page.goto(`/aplikacija${PATH}`);
  await expect(page).toHaveURL(new RegExp(`/aplikacija${PATH}/izjava$`));
  await expect(page.getByRole("heading", { level: 1, name: "Izjava" })).toBeVisible();
});

test("a submitted work opens on the receipt, read from the server", async ({ page }) => {
  await student(page, "submitted");
  await page.route(`**/api/v1/student/assignments/${ID}/submission`, (route) => route.fulfill({
    status: 500, json: { code: "internal" },
  }));
  await page.goto(`/aplikacija${PATH}`);
  await expect(page).toHaveURL(new RegExp(`/aplikacija${PATH}/potvrda$`));
  await expect(page.getByRole("heading", { level: 1, name: "Potvrda predaje" })).toBeVisible();
});

test("a notice not yet acknowledged comes first", async ({ page }) => {
  await student(page, "not_started", true);
  await page.route(`**/api/v1/student/assignments/${ID}/notice`, (route) => route.fulfill({ status: 503, json: { code: "unavailable" } }));
  await page.goto(`/aplikacija${PATH}/pregled`);
  await expect(page).toHaveURL(new RegExp(`/aplikacija/zadatak/${ID}$`));
});

test("a 401 sends the student to AAI@EduHr, back to the same step", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.route("**/api/v1/student/**", (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.route("**/api/v1/auth/login**", (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: '<!doctype html><html lang="hr"><title>AAI@EduHr</title><p>Lažni AAI@EduHr</p></html>',
  }));
  await page.goto(`/aplikacija${PATH}/slanje`);
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(`/aplikacija${PATH}/slanje`);
});
