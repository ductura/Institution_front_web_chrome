// The institution front's session (#2028 c.6993786629 §3.3) over a fake
// institution server (page.route): 401 sends the browser to AAI@EduHr sign-in
// with returnTo, 200 opens the role's home with the institution's name, and
// sign-out posts auth.logout.post and leaves for the preloader. Invented
// people, institutions and courses only.
import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const INSTITUTION = "Izmišljeni fakultet za testove";
const assignments = JSON.parse(readFileSync(new URL("../../../src/components/student/fixtures/student.assignments.get.json", import.meta.url), "utf8")) as {
  vectors: { name: string; response: { body: unknown } }[];
};
const ready = assignments.vectors.find((v) => v.name === "ready")!.response.body;
// Bodies of the teacher.courses.get "courses" and teacher.mentorships.get "works" vectors of @ductura/test-fakes 3.0.1.
const teacher = JSON.parse(readFileSync(new URL("./fixtures/teacher.json", import.meta.url), "utf8")) as Record<string, unknown>;

type Me = { status: number; body?: unknown };

/** Fakes the institution server: /me, the student's assignments, login and logout. Returns what was asked. */
async function fakeServer(page: Page, me: Me) {
  const seen = { me: 0, logout: 0, login: [] as string[], meCredentials: [] as (string | null)[] };
  await page.route("**/api/v1/me", async (route) => {
    seen.me += 1;
    seen.meCredentials.push(route.request().headers()["cookie"] ?? null);
    await route.fulfill({ status: me.status, contentType: "application/json", body: JSON.stringify(me.body ?? { code: "unauthenticated" }) });
  });
  await page.route("**/api/v1/student/assignments", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ready) }));
  await page.route("**/api/v1/teacher/courses", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(teacher["teacher.courses.get"]) }));
  await page.route("**/api/v1/teacher/mentorships", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(teacher["teacher.mentorships.get"]) }));
  await page.route("**/api/v1/auth/login**", async (route) => {
    seen.login.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html lang=\"hr\"><title>AAI@EduHr</title><p>Lažni AAI@EduHr</p></html>" });
  });
  await page.route("**/api/v1/auth/logout", async (route) => {
    seen.logout += 1;
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 303, headers: { location: "/" } });
  });
  return seen;
}

/** Console errors and uncaught exceptions of the page. */
function errorsOf(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}

test("401 sends the browser to AAI@EduHr sign-in with the current path as returnTo", async ({ page }) => {
  const seen = await fakeServer(page, { status: 401 });
  await page.goto("/app/web/zadaci/kolegiji");
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(seen.login[0]!).searchParams.get("returnTo")).toBe("/app/web/zadaci/kolegiji");
});

test("401 under /app/chrome returns to /app/chrome", async ({ page }) => {
  const seen = await fakeServer(page, { status: 401 });
  await page.goto("/app/chrome/");
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(seen.login[0]!).searchParams.get("returnTo")).toBe("/app/chrome/");
});

test("a student lands on Vaš studentski prostor with the institution's name, without console errors", async ({ page }) => {
  const errors = errorsOf(page);
  const seen = await fakeServer(page, { status: 200, body: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: INSTITUTION } } });
  await page.goto("/app/web/");
  await expect(page).toHaveURL(/\/app\/web\/zadaci$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vaš studentski prostor");
  await expect(page.getByText("Izmišljeni zadatak 1")).toBeVisible();
  await expect(page.getByText(INSTITUTION)).toBeVisible();
  expect(seen.me).toBe(1);
  await axe(page);

  // The shell's navigation opens in place, under the same base.
  await page.getByRole("navigation", { name: "Radni prostor" }).getByRole("link", { name: "Moji kolegiji" }).click();
  await expect(page).toHaveURL(/\/app\/web\/zadaci\/kolegiji$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji kolegiji");
  expect(seen.me).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/web\/zadaci$/);
  expect(errors).toEqual([]);
});

test("a teacher lands on /nastavnik and an administrator on /ustanova", async ({ page }) => {
  const errors = errorsOf(page);
  await fakeServer(page, { status: 200, body: { roles: ["teacher"], institutionName: INSTITUTION } });
  await page.goto("/app/web/");
  await expect(page).toHaveURL(/\/app\/web\/nastavnik$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji kolegiji");
  await expect(page.getByText("Izmišljeni kolegij nastavnika")).toBeVisible();
  await expect(page.getByText(INSTITUTION)).toBeVisible();
  await axe(page);

  await page.getByRole("navigation", { name: "Radni prostor" }).getByRole("link", { name: "Radovi uz mentora" }).click();
  await expect(page).toHaveURL(/\/app\/web\/nastavnik\/mentorstva$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Radovi uz mentora");
  await expect(page.getByText("Izmišljeni diplomski rad")).toBeVisible();
  await axe(page);

  await page.unrouteAll({ behavior: "wait" });
  await fakeServer(page, { status: 200, body: { role: "institution_admin", institution: { displayName: INSTITUTION } } });
  await page.goto("/app/chrome/zadaci");
  await expect(page).toHaveURL(/\/app\/chrome\/ustanova$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pregled ustanove");
  await expect(page.getByText(INSTITUTION)).toBeVisible();
  await axe(page);
  expect(errors).toEqual([]);
});

test("Odjava posts auth.logout.post and leaves for the preloader", async ({ page }) => {
  const seen = await fakeServer(page, { status: 200, body: { role: "student", institution: { displayName: INSTITUTION } } });
  await page.goto("/app/web/zadaci");
  await page.getByRole("button", { name: "Odjava" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect(seen.logout).toBe(1);
});

test("an unanswering institution server shows a retry, not an empty app", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{\"code\":\"unavailable\"}" }));
  await page.goto("/app/web/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prijavu nije bilo moguće provjeriti");
  await expect(page.getByRole("button", { name: "Pokušaj ponovno" })).toBeVisible();
  await axe(page);
});

test("a teacher's read: 403 asks for a teacher account, 503 offers a retry that reads again", async ({ page }) => {
  await fakeServer(page, { status: 200, body: { role: "teacher", institution: { displayName: INSTITUTION } } });
  let courses = 0;
  await page.route("**/api/v1/teacher/courses", (route) => {
    courses += 1;
    return route.fulfill({ status: 503, contentType: "application/json", body: "{\"code\":\"unavailable\",\"error\":\"unavailable\"}" });
  });
  await page.route("**/api/v1/teacher/mentorships", (route) =>
    route.fulfill({ status: 403, contentType: "application/json", body: "{\"code\":\"forbidden\",\"error\":\"forbidden\"}" }));
  await page.goto("/app/web/nastavnik");
  // Next keeps an empty role="alert" route announcer outside <main>.
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Kolegiji trenutačno nisu dostupni. Pokušajte ponovno.");
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect.poll(() => courses).toBe(2);
  await axe(page);
  await page.goto("/app/web/nastavnik/mentorstva");
  await expect(page.getByText("Prijavite se nastavničkim računom.")).toBeVisible();
});

test("a teacher's read answering 401 sends the browser to sign-in", async ({ page }) => {
  const seen = await fakeServer(page, { status: 200, body: { role: "teacher" } });
  await page.route("**/api/v1/teacher/courses", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{\"code\":\"unauthorized\",\"error\":\"unauthorized\"}" }));
  await page.goto("/app/web/nastavnik");
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(seen.login.at(-1)!).searchParams.get("returnTo")).toBe("/app/web/nastavnik");
});

test("a student's Ductus pages open at their addresses, marked as not connected yet", async ({ page }) => {
  const errors = errorsOf(page);
  const seen = await fakeServer(page, { status: 200, body: { role: "student", institution: { displayName: INSTITUTION } } });
  await page.goto("/app/chrome/rad/izm-zadatak-1/predaja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Predaja rada");
  await expect(page.getByText("Ovaj prikaz još nije spojen na poslužitelj ustanove.")).toBeVisible();
  await axe(page);

  await page.getByRole("navigation", { name: "Radni prostor" }).getByRole("link", { name: "Moji radovi" }).click();
  await expect(page).toHaveURL(/\/app\/chrome\/zadaci\/radovi$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji radovi");
  expect(seen.me).toBe(1);
  expect(errors).toEqual([]);

  await page.unrouteAll({ behavior: "wait" });
  await fakeServer(page, { status: 200, body: { roles: ["teacher"], institutionName: INSTITUTION } });
  await page.goto("/app/web/rad/izm-zadatak-1/predaja");
  await expect(page).toHaveURL(/\/app\/web\/nastavnik$/);
});

test("a teacher's Ductus pages open at their addresses, and /nastavnik/kolegiji forwards to /nastavnik", async ({ page }) => {
  const errors = errorsOf(page);
  await fakeServer(page, { status: 200, body: { roles: ["teacher"], institutionName: INSTITUTION } });
  await page.goto("/app/chrome/nastavnik/kolegiji");
  await expect(page).toHaveURL(/\/app\/chrome\/nastavnik$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji kolegiji");

  await page.goto("/app/web/nastavnik/zadatak/izm-zadatak-1/uredi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nova verzija zadatka");
  await expect(page.getByText("Ovaj prikaz još nije spojen na poslužitelj ustanove.")).toBeVisible();
  await axe(page);
  await page.goto("/app/web/nastavnik/rad/izm-rad-1/reprodukcija");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reprodukcija rada");
  expect(errors).toEqual([]);
});
