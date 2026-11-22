import { expect, test, type Page } from "./fixtures/test";

// HOST-S5: "Moji radovi", the access log and the replay in the host, with an invented /api/v1.
const ID = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e5f6";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1e";
const TITLE = "Izmišljeni esej o pčelarstvu";

async function student(page: Page, workState: "not_started" | "in_progress" | "submitted") {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: TITLE, dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState }] },
  }));
}

test("Moji radovi lists the work, linked under the same base", async ({ page }) => {
  await student(page, "in_progress");
  await page.goto("/app/chrome/zadaci/radovi");
  await expect(page.getByRole("heading", { name: "Moji radovi" })).toBeVisible();
  await expect(page.getByText(TITLE).first()).toBeVisible();
  await expect(page.locator(`a[href="/app/chrome/rad/${ID}"]`)).toBeVisible();
});

test("the access log of a work in progress reads as unavailable, never an empty log", async ({ page }) => {
  await student(page, "in_progress");
  await page.goto(`/app/web/rad/${ID}/dnevnik-pristupa`);
  await expect(page.getByRole("heading", { name: "Tko je otvorio Vaš rad" })).toBeVisible();
  await expect(page.getByText("Dnevnik trenutačno nije moguće učitati.", { exact: false })).toBeVisible();
});

test("the replay of a work not started says so", async ({ page }) => {
  await student(page, "not_started");
  await page.goto(`/app/web/rad/${ID}/reprodukcija`);
  await expect(page.getByRole("heading", { name: "Reprodukcija Vašeg rada" })).toBeVisible();
  await expect(page.getByText("Rad još nije započet, pa nema reprodukcije.")).toBeVisible();
});

test("a submitted work whose receipt fails to read shows the replay as unavailable", async ({ page }) => {
  await student(page, "submitted");
  await page.route(`**/api/v1/student/assignments/${ID}/submission`, (route) => route.fulfill({
    status: 500, json: { code: "internal" },
  }));
  await page.goto(`/app/web/rad/${ID}/reprodukcija`);
  await expect(page.getByText("Reprodukcija se trenutačno ne može učitati.")).toBeVisible();
});

test("a 401 sends the student to AAI@EduHr, back to the access log", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.route("**/api/v1/student/**", (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.route("**/api/v1/auth/login**", (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: '<!doctype html><html lang="hr"><title>AAI@EduHr</title><p>Lažni AAI@EduHr</p></html>',
  }));
  await page.goto(`/app/web/rad/${ID}/dnevnik-pristupa`);
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(`/app/web/rad/${ID}/dnevnik-pristupa`);
});
