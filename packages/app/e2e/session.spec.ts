// The institution front's session (#2028 c.6993786629 §3.3) over a fake
// institution server (page.route): 401 sends the browser to AAI@EduHr sign-in
// with returnTo, 200 opens the role's home with the institution's name, and
// sign-out posts auth.logout.post and then follows it natively on to the
// provider's logout and the preloader (INT-20c). Invented
// people, institutions and courses only.
import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const INSTITUTION = "Izmišljeni fakultet za testove";
const assignments = JSON.parse(readFileSync(new URL("../../../src/components/student/fixtures/student.assignments.get.json", import.meta.url), "utf8")) as {
  vectors: { name: string; response: { body: unknown } }[];
};
const ready = assignments.vectors.find((v) => v.name === "ready")!.response.body;
// Bodies of the teacher.courses.get "courses" and teacher.mentorships.get "works" vectors of @ductura/test-fakes 3.0.1.
const teacher = JSON.parse(readFileSync(new URL("./fixtures/teacher.json", import.meta.url), "utf8")) as Record<string, unknown>;

/** The teaching-team view of a course the teacher holds alone (institution.teaching-team-view.get, holder). */
const TEAM_HOLDER_ID = "5e4d3c2b-1a09-4f8e-8d7c-6b5a49382701";
const HOLDER_VIEW = { role: "holder", holderId: TEAM_HOLDER_ID, assistants: [], students: [], groups: [] };

type Me = { status: number; body?: unknown };

/** Fakes the institution server: /me, the student's assignments, login and logout. Returns what was asked. */
async function fakeServer(page: Page, me: Me) {
  const seen = { me: 0, logout: 0, logoutKinds: [] as string[], login: [] as string[], meCredentials: [] as (string | null)[] };
  await page.route("**/api/v1/me", async (route) => {
    seen.me += 1;
    seen.meCredentials.push(route.request().headers()["cookie"] ?? null);
    await route.fulfill({ status: me.status, contentType: "application/json", body: JSON.stringify(me.body ?? { code: "unauthenticated" }) });
  });
  // WEB-NUZ-NF1 (P-1): the shell's bell reads the inbox; it is empty here.
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], nextBefore: null }) }));
  // WEB-1804: the host reads the saved interface language once signed in; none is saved here.
  await page.route("**/api/v1/profile/interface-locale", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locale: null }) }));
  await page.route("**/api/v1/student/assignments", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ready) }));
  // WEB-2102/WEB-2103/WEB-2105: the student's pages also read the state of each work; none is started here.
  await page.route("**/api/v1/student/assignment-work", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assignments: [] }) }));
  // WEB-2144: each course card reads the caller's role from the teaching-team view; here the teacher holds the course alone.
  await page.route("**/api/v1/courses/*/team/view", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(HOLDER_VIEW) }));
  await page.route("**/api/v1/courses/*/team/candidates", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates: [] }) }));
  await page.route("**/api/v1/courses/*/team", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ holderId: TEAM_HOLDER_ID, assistantIds: [] }) }));
  await page.route("**/api/v1/teacher/courses", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(teacher["teacher.courses.get"]) }));
  // WEB-2145 (#411): the N-01 task facts read each course's roster, then per assignment its submissions,
  // overview and deadline extensions; here nobody is enrolled yet (empty-roster and the empty lists).
  await page.route("**/api/v1/teacher/courses/*/students", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ students: [] }) }));
  await page.route("**/api/v1/teacher/assignments/*/submissions", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ submissions: [] }) }));
  await page.route("**/api/v1/teacher/assignments/*/overview", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ students: [] }) }));
  await page.route("**/api/v1/teacher/assignments/*/deadline-extensions", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ extensions: [] }) }));
  await page.route("**/api/v1/teacher/mentorships", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(teacher["teacher.mentorships.get"]) }));
  // LOK-WEB-5: the teacher's mentorship page reads open requests (teacher.mentorship-requests.get "empty-requests").
  await page.route("**/api/v1/teacher/mentorship-requests", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requests: [] }) }));
  await page.route("**/api/v1/auth/login**", async (route) => {
    seen.login.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html lang=\"hr\"><title>AAI@EduHr</title><p>Lažni AAI@EduHr</p></html>" });
  });
  await page.route("**/api/v1/auth/logout", async (route) => {
    seen.logout += 1;
    seen.logoutKinds.push(route.request().resourceType());
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
  await page.goto("/aplikacija/zadaci/kolegiji");
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(seen.login[0]!).searchParams.get("returnTo")).toBe("/aplikacija/zadaci/kolegiji");
});

// D-318 (DAN-1574): /app/web and /app/chrome are not served by this app; the edge redirects them to /aplikacija.
for (const old of ["/app/web/", "/app/chrome/", "/app/web/zadaci", "/app/chrome/rad"]) {
  test(`the old address ${old} is not a page of the app`, async ({ page }) => {
    await fakeServer(page, { status: 200, body: { role: "student", institution: { displayName: INSTITUTION } } });
    const response = await page.goto(old);
    expect(response?.status()).toBe(404);
  });
}

test("a student lands on Vaš studentski prostor with the institution's name, without console errors", async ({ page }) => {
  const errors = errorsOf(page);
  const seen = await fakeServer(page, { status: 200, body: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: INSTITUTION } } });
  await page.goto("/aplikacija/");
  await expect(page).toHaveURL(/\/aplikacija\/zadaci$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vaš studentski prostor");
  await expect(page.getByText("Izmišljeni zadatak 1")).toBeVisible();
  await expect(page.getByText(INSTITUTION)).toBeVisible();
  expect(seen.me).toBe(1);
  await axe(page);

  // The shell's navigation opens in place, under the same base.
  await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Moji kolegiji" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/zadaci\/kolegiji$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji kolegiji");
  expect(seen.me).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/aplikacija\/zadaci$/);
  expect(errors).toEqual([]);
});

/** LOK-WEB-8: the administrator's three reads, answering with invented data. */
async function institutionReads(page: Page) {
  const A = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/v1/institution/teachers", (route) => route.fulfill({ json: {
    pending: [{ personId: A, name: { givenName: "Ana", familyName: "Izmišljena" }, revokedAt: null }],
    confirmed: [{ personId: "22222222-2222-4222-8222-222222222222", name: { givenName: "Ivo", familyName: "Primjer" }, confirmedAt: "2026-10-02T08:00:00.000Z", forReview: false }],
  } }));
  await page.route("**/api/v1/institution/admin/academic-years", (route) => route.fulfill({ json: { years: ["2026/2027"] } }));
  await page.route("**/api/v1/institution/admin/courses?*", (route) => route.fulfill({ json: { academicYear: "2026/2027", courses: [
    { courseId: A, name: "Izmišljeni seminar", students: 7, holder: null, team: [], groups: [] },
  ] } }));
}

test("a teacher lands on /nastavnik and an administrator on /ustanova", async ({ page }) => {
  const errors = errorsOf(page);
  await fakeServer(page, { status: 200, body: { roles: ["teacher"], institutionName: INSTITUTION } });
  await page.goto("/aplikacija/");
  await expect(page).toHaveURL(/\/aplikacija\/nastavnik$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji kolegiji");
  await expect(page.getByText("Izmišljeni kolegij nastavnika")).toBeVisible();
  await expect(page.getByText(INSTITUTION)).toBeVisible();
  await axe(page);

  await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Radovi uz mentora" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/nastavnik\/mentorstva$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Radovi uz mentora");
  // WEB-NF6-PREGLED: the title also stands in "Moji studenti", so the works list is named.
  await expect(page.getByTestId("mentored-work").getByText("Izmišljeni diplomski rad")).toBeVisible();
  await axe(page);

  await page.unrouteAll({ behavior: "wait" });
  await fakeServer(page, { status: 200, body: { role: "institution_admin", institution: { displayName: INSTITUTION } } });
  await institutionReads(page);
  await page.goto("/aplikacija/zadaci");
  await expect(page).toHaveURL(/\/aplikacija\/ustanova$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pregled ustanove");
  await expect(page.getByText(INSTITUTION)).toBeVisible();
  await axe(page);
  expect(errors).toEqual([]);
});

test("Odjava posts auth.logout.post and leaves for the preloader", async ({ page }) => {
  const seen = await fakeServer(page, { status: 200, body: { role: "student", institution: { displayName: INSTITUTION } } });
  await page.goto("/aplikacija/zadaci");
  await page.getByRole("button", { name: "Odjava" }).click();
  // A-6: the dialog asks first; "Ostani" ends nothing.
  const dialog = page.getByRole("dialog", { name: "Odjava" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Odjavit ćete se iz Ducture i iz sustava AAI@EduHr");
  await dialog.getByRole("button", { name: "Ostani" }).click();
  await expect(dialog).toBeHidden();
  expect(seen.logout).toBe(0);
  await page.getByRole("button", { name: "Odjava" }).click();
  await dialog.getByRole("button", { name: "Odjavi se" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  // INT-20c: the confirmed request, then the same route natively, so the browser follows its redirect.
  expect(seen.logoutKinds).toEqual(["fetch", "document"]);
});

test("a 403 from /me shows the no-role card with Odjava, not the retry screen (E-1 bezuloge)", async ({ page }) => {
  const seen = await fakeServer(page, { status: 403, body: { code: "forbidden" } });
  await page.goto("/aplikacija/zadaci");
  const card = page.getByRole("status").filter({ hasText: "Prijava je uspjela" });
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Prijava je uspjela");
  await expect(card).toContainText("Ovaj račun još nema dodijeljenu ulogu, pa se Vaš prostor ne može otvoriti.");
  await expect(card).toContainText("Javite se koordinatoru (administratoru fakulteta) na svojoj ustanovi.");
  await axe(page);
  await card.getByRole("button", { name: "Odjava" }).click();
  await page.getByRole("dialog", { name: "Odjava" }).getByRole("button", { name: "Odjavi se" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  // INT-20c: the confirmed request, then the same route natively, so the browser follows its redirect.
  expect(seen.logoutKinds).toEqual(["fetch", "document"]);
});

test("/prijava shows the six variants of E-1 and goes to AAI@EduHr only from the button", async ({ page }) => {
  const seen = await fakeServer(page, { status: 401 });
  const errors = errorsOf(page);
  await page.goto("/aplikacija/prijava");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dobro došli");
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Vaš akademski identitet.");
  await expect(page.getByText("Lozinku upisujete samo kod AAI@EduHr.")).toBeVisible();
  await expect(page.getByText("Ne možete se prijaviti računom AAI@EduHr?")).toBeHidden();
  // PAR2-A1: "Vaš prostor" in the role note, and the help lives in the card, not in the footer.
  await expect(page.getByText("otvara se Vaš prostor prema dodijeljenoj ulozi")).toBeVisible();
  await expect(page.getByRole("main").locator("details", { hasText: "Trebate pomoć?" })).toHaveCount(1);
  await expect(page.getByRole("contentinfo").locator("details")).toHaveCount(0);
  await expect(page.locator("details", { hasText: "Prvi dolazak ili imate kod zadatka?" })).toHaveAttribute("open", "");
  await axe(page);
  expect(seen.login).toEqual([]);
  expect(seen.me).toBe(0);

  await page.goto("/aplikacija/prijava?stanje=pomoc");
  await expect(page.locator("details", { hasText: "Trebate pomoć?" })).toHaveAttribute("open", "");
  await expect(page.locator("details", { hasText: "Prvi dolazak ili imate kod zadatka?" })).not.toHaveAttribute("open", "");
  await expect(page.getByRole("link", { name: "Službena pomoć AAI@EduHr" })).toBeVisible();

  for (const query of ["stanje=greska", "greska=login_failed"]) {
    await page.goto(`/aplikacija/prijava?${query}`);
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert.getByRole("heading", { level: 2 })).toHaveText("Prijava nije dovršena");
    await expect(alert).toContainText("Pokušajte ponovno; ako se ponovi, javite se koordinatoru");
    await expect(alert.getByRole("link", { name: "Na početnu" })).toHaveAttribute("href", "/");
    await axe(page);
  }
  for (const query of ["stanje=nedostupno", "greska=provider_unavailable"]) {
    await page.goto(`/aplikacija/prijava?${query}`);
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("Prijava preko AAI@EduHr trenutačno ne odgovara. Pokušajte ponovno za nekoliko minuta.");
    await expect(alert.getByRole("link", { name: "Pokušaj ponovno" })).toBeVisible();
    await expect(alert.getByRole("link", { name: "Na početnu" })).toHaveCount(0);
  }

  await page.goto("/aplikacija/prijava?stanje=bezuloge");
  await expect(page.getByRole("status").filter({ hasText: "Prijava je uspjela" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odjava" })).toBeVisible();

  await page.goto("/aplikacija/prijava?stanje=greska&returnTo=%2Fzadaci%2Fkolegiji");
  await page.getByRole("link", { name: "Pokušaj ponovno" }).click();
  await page.waitForURL(/\/api\/v1\/auth\/login\?returnTo=/, { waitUntil: "commit" });
  expect(new URL(seen.login[0]!).searchParams.get("returnTo")).toBe("/aplikacija/zadaci/kolegiji");
  expect(errors).toEqual([]);
});

// F4-STU-R01: the server returns a failed or refused sign-in to /prijava?greska=<code> at the ROOT.
test("the root /prijava of the server's error codes reaches E-1 with the whole query", async ({ page }) => {
  await fakeServer(page, { status: 401 });
  const errors = errorsOf(page);
  const cases: [string, RegExp][] = [
    ["login_refused", /Prijava je odbijena/],
    ["login_failed", /Prijava nije dovršena/],
    ["provider_unavailable", /AAI@EduHr trenutačno ne odgovara|trenutačno ne odgovara/],
  ];
  for (const [code, heading] of cases) {
    await page.goto(`/prijava?greska=${code}&returnTo=%2Fzadaci`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL((url) => url.pathname === "/aplikacija/prijava" && url.searchParams.get("greska") === code && url.searchParams.get("returnTo") === "/zadaci");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(heading);
  }
  // Without a code the root path still lands on the app's sign-in, with no query invented.
  await page.goto("/prijava", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL((url) => url.pathname === "/aplikacija/prijava" && url.search === "");
  expect(errors).toEqual([]);
});

test("an unanswering institution server shows a retry, not an empty app", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{\"code\":\"unavailable\"}" }));
  await page.goto("/aplikacija/");
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
  await page.goto("/aplikacija/nastavnik");
  // Next keeps an empty role="alert" route announcer outside <main>. Inside it, the N-01 toast region
  // (WEB-2145) keeps its own role="alert" live region on the page before any message; it stays empty.
  await expect(page.getByRole("region", { name: "Obavijesti" }).getByRole("alert")).toBeEmpty();
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Popis kolegija trenutačno nije dostupan. Pokušajte ponovno; popis se ne prikazuje prazan dok se ne učita.");
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect.poll(() => courses).toBe(2);
  await axe(page);
  await page.goto("/aplikacija/nastavnik/mentorstva");
  await expect(page.getByText("Prijavite se nastavničkim računom.")).toBeVisible();
});

test("a teacher's read answering 401 sends the browser to sign-in", async ({ page }) => {
  const seen = await fakeServer(page, { status: 200, body: { role: "teacher" } });
  await page.route("**/api/v1/teacher/courses", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{\"code\":\"unauthorized\",\"error\":\"unauthorized\"}" }));
  await page.goto("/aplikacija/nastavnik");
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(seen.login.at(-1)!).searchParams.get("returnTo")).toBe("/aplikacija/nastavnik");
});

test("a student's Ductus pages open at their addresses; the workspace without a work in progress points to Moji zadaci", async ({ page }) => {
  const errors = errorsOf(page);
  const seen = await fakeServer(page, { status: 200, body: { role: "student", institution: { displayName: INSTITUTION } } });
  await page.goto("/aplikacija/rad");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Radni prostor");
  // WEB-2105 (#359) connected /rad: it reads the works, and none is in progress here.
  await expect(page.getByText("Nemate rad u tijeku. Rad započnite na kartici zadatka.")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Moji zadaci" })).toHaveAttribute("href", "/aplikacija/zadaci");
  await axe(page);

  // Moji radovi is connected (HOST-S5): it reads an empty list.
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({ json: { courses: [] } }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({ json: { assignments: [] } }));
  await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Moji radovi" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/zadaci\/radovi$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji radovi");
  expect(seen.me).toBe(1);
  expect(errors).toEqual([]);

  await page.unrouteAll({ behavior: "wait" });
  await fakeServer(page, { status: 200, body: { roles: ["teacher"], institutionName: INSTITUTION } });
  await page.goto("/aplikacija/rad/izm-zadatak-1/predaja");
  await expect(page).toHaveURL(/\/aplikacija\/nastavnik$/);
});

test("a teacher's Ductus pages open at their addresses, and /nastavnik/kolegiji forwards to /nastavnik", async ({ page }) => {
  const errors = errorsOf(page);
  await fakeServer(page, { status: 200, body: { roles: ["teacher"], institutionName: INSTITUTION } });
  await page.goto("/aplikacija/nastavnik/kolegiji");
  await expect(page).toHaveURL(/\/aplikacija\/nastavnik$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moji kolegiji");

  await page.goto("/aplikacija/nastavnik/brz-put");
  // Brz put is mounted (WEB-2142): without ?zadatak= it asks for an assignment.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Brz put");
  await expect(page.getByRole("status")).toBeVisible();
  await axe(page);
  expect(errors).toEqual([]);
});

test("the administrator's Ductus pages open at their addresses, and only for the administrator", async ({ page }) => {
  const errors = errorsOf(page);
  const seen = await fakeServer(page, { status: 200, body: { role: "institution_admin", institution: { displayName: INSTITUTION } } });
  // WEB-1406 (#303) put the faculty rules page here in place of the placeholder; no rule is published yet.
  await page.route("**/api/v1/institution/faculty-rules", (route) => route.fulfill({ json: { rules: [] } }));
  await institutionReads(page);
  await page.goto("/aplikacija/ustanova/pravila");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pravila fakulteta");
  await expect(page.getByText("Za ovu vrstu rada pravilo još nije objavljeno.")).toBeVisible();
  await axe(page);
  await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Korisnici" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/ustanova\/korisnici$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Korisnici");
  await expect(page.getByText("Ana Izmišljena")).toBeVisible();
  await expect(page.getByRole("button", { name: "Potvrdi ulogu" })).toBeVisible();
  expect(seen.me).toBe(1);
  await page.goto("/aplikacija/ustanova");
  await expect(page.getByText("Potvrđeni nastavnici")).toBeVisible();
  await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Kolegiji" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/ustanova\/kolegiji$/);
  await expect(page.getByText("Izmišljeni seminar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Novi kolegij" })).toBeVisible();
  expect(seen.me).toBe(2);
  expect(errors).toEqual([]);

  await page.unrouteAll({ behavior: "wait" });
  await fakeServer(page, { status: 200, body: { role: "student", institution: { displayName: INSTITUTION } } });
  await page.goto("/aplikacija/ustanova/kolegiji");
  await expect(page).toHaveURL(/\/aplikacija\/zadaci$/);
});

const ADMIN_COURSES = "**/api/v1/institution/admin/courses";
const COURSE_NAME = "Izmišljeni seminar o gradskim vrtovima";
const HOLDER_ID = "00000000-0000-4000-8000-000000000001";

async function openNewCourse(page: Page, base: "/aplikacija") {
  await fakeServer(page, { status: 200, body: { role: "institution_admin", institution: { displayName: INSTITUTION } } });
  await page.goto(`${base}/ustanova/kolegiji`);
  await page.getByLabel("Naziv kolegija").fill(COURSE_NAME);
  await page.getByLabel("Identifikator nositelja").fill(HOLDER_ID);
}

test("course creation reports a failed write and confirms only after the API responds", async ({ page }) => {
  await openNewCourse(page, "/aplikacija");
  await page.route(ADMIN_COURSES, (route) => route.fulfill({ status: 503, json: { code: "unavailable" } }));
  const submit = page.getByRole("button", { name: "Izradi kolegij" });
  const confirmed = page.getByText(`Kolegij „${COURSE_NAME}” je izrađen.`, { exact: true });
  await submit.click();
  await expect(page.getByRole("region", { name: "Novi kolegij" }).getByRole("alert"))
    .toHaveText("Kolegij trenutačno nije moguće izraditi. Pokušajte ponovno.");
  await expect(confirmed).toHaveCount(0);
  await page.unroute(ADMIN_COURSES);

  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route(ADMIN_COURSES, async (route) => {
    await responseGate;
    await route.fulfill({ status: 200, json: {
      id: "00000000-0000-4000-8000-000000000002",
      groups: [],
    } });
  });
  const sent = page.waitForRequest((request) => request.url().endsWith("/api/v1/institution/admin/courses"));
  try {
    await submit.click();
    const request = await sent;
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({
      name: COURSE_NAME, holderId: HOLDER_ID, academicYear: expect.stringMatching(/^\d{4}\/\d{4}$/),
      aiPolicy: "prohibited", groups: [],
    });
    await expect(page.getByRole("button", { name: "Izrađuje se…" })).toBeDisabled();
    await expect(confirmed).toHaveCount(0);
  } finally {
    releaseResponse();
  }
  await expect(confirmed).toBeVisible();
  await page.getByRole("button", { name: "Izradi još jedan kolegij" }).click();
  await expect(page.getByLabel("Naziv kolegija")).toHaveValue("");
});

test("401 during course creation returns to the administrator's Chrome route after sign-in", async ({ page }) => {
  await openNewCourse(page, "/aplikacija");
  await page.route(ADMIN_COURSES, (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.getByRole("button", { name: "Izradi kolegij" }).click();
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/aplikacija/ustanova/kolegiji");
});

test("Kako Ductura radi opens the explanation inside the signed-in shell", async ({ page }) => {
  const seen = await fakeServer(page, { status: 200, body: { role: "student", institutionName: INSTITUTION } });
  await page.goto("/aplikacija/zadaci");
  await page.getByRole("link", { name: "Kako Ductura radi" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/kako-radi$/);
  await expect(page.getByRole("heading", { name: "Kako Ductura radi", level: 1 })).toBeVisible();
  await expect(page.getByRole("table", { name: "Tko što vidi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kako se rad sprema" })).toBeVisible();
  expect(seen.me).toBe(1);
});

test("Kako Ductura radi preserves the current base when sign-in is needed", async ({ page }) => {
  const seen = await fakeServer(page, { status: 401 });
  await page.goto("/aplikacija/kako-radi");
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?returnTo=/);
  expect(new URL(seen.login[0]!).searchParams.get("returnTo")).toBe("/aplikacija/kako-radi");
});

const STATUS_PATH = "**/api/v1/status";
const PUBLIC_STATUS = {
  checkedAt: "2026-11-20T08:30:00Z",
  components: { writing: "radi", submission: "ne_radi", mentorView: "nije_ukljuceno" },
};

test("Stanje sustava and Prijava open without reading the session", async ({ page }) => {
  const errors = errorsOf(page);
  const seen = await fakeServer(page, { status: 401 });
  await page.route(STATUS_PATH, (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ status: 200, json: PUBLIC_STATUS });
  });
  await page.goto("/aplikacija/stanje");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stanje sustava");
  await expect(page.getByRole("link", { name: "Ductura", exact: true })).toHaveAttribute("href", "/aplikacija/");
  await expect(page.getByRole("status")).toHaveText("Neki dijelovi trenutačno ne rade.");
  await expect(page.getByRole("listitem").filter({ hasText: "Pisanje i slanje na poslužitelj" })).toContainText("Radi");
  await expect(page.getByRole("listitem").filter({ hasText: "Predaja rada" })).toContainText("Ne radi");
  await expect(page.getByRole("listitem").filter({ hasText: "Prikaz za mentora" })).toContainText("Nije uključeno");
  await expect(page.getByText(/^Zadnja provjera:/)).toBeVisible();
  await expect(page.getByText("Trenutačno nema planiranih održavanja.")).toBeVisible();
  await expect(page.getByText("Nema zabilježenih prekida.")).toBeVisible();
  expect(seen.login).toEqual([]);
  await axe(page);
  expect(errors).toEqual([]);

  await page.goto("/aplikacija/prijava?returnTo=%2Fzadaci%2Fkolegiji");
  await page.getByRole("link", { name: "Prijava sustavom AAI@EduHr" }).click();
  await page.waitForURL(/\/api\/v1\/auth\/login\?returnTo=/, { waitUntil: "commit" });
  expect(seen.login).toHaveLength(1);
  expect(new URL(seen.login[0]!).searchParams.get("returnTo")).toBe("/aplikacija/zadaci/kolegiji");
  await page.goto("/aplikacija/prijava?returnTo=https%3A%2F%2Fexample.org%2F");
  await page.getByRole("link", { name: "Prijava sustavom AAI@EduHr" }).click();
  await page.waitForURL(/\/api\/v1\/auth\/login\?returnTo=/, { waitUntil: "commit" });
  expect(seen.login).toHaveLength(2);
  expect(new URL(seen.login[1]!).searchParams.get("returnTo")).toBe("/aplikacija/");
  expect(seen.me).toBe(0);
});

test("Stanje sustava has no horizontal scroll at 360 px", async ({ page }) => {
  await fakeServer(page, { status: 401 });
  await page.route(STATUS_PATH, (route) => route.fulfill({ status: 200, json: PUBLIC_STATUS }));
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/aplikacija/stanje");
  await expect(page.getByText("Nema zabilježenih prekida.")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Stanje sustava shows an API refusal without sending the reader to sign-in", async ({ page }) => {
  const seen = await fakeServer(page, { status: 401 });
  await page.route(STATUS_PATH, (route) => route.fulfill({ status: 401, json: { code: "unauthenticated" } }));
  await page.goto("/aplikacija/stanje");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Rezultate provjera trenutačno nije moguće učitati.");
  await expect(page).toHaveURL(/\/aplikacija\/stanje$/);
  expect(seen.me).toBe(0);
  expect(seen.login).toEqual([]);
});

test("Stanje sustava shows a service failure and recovers after retry", async ({ page }) => {
  let available = false;
  await page.route(STATUS_PATH, (route) => route.fulfill(available
    ? { status: 200, json: PUBLIC_STATUS }
    : { status: 503, json: { code: "unavailable" } }));
  await page.goto("/aplikacija/stanje");
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Rezultate provjera trenutačno nije moguće učitati.");
  available = true;
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect(page.getByRole("status")).toHaveText("Neki dijelovi trenutačno ne rade.");
  await expect(alert).toHaveCount(0);
});
