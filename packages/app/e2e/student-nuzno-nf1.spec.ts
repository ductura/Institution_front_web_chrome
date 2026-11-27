// WEB-NUZ-NF1 (NF-1 P-1, P-3, P-10, P-11, P-15): the bell over the contract's inbox,
// the deadline tag on the student's home, one code rule from the home card to E-5,
// the text for too many enrolment attempts and the refused sign-in. Every person,
// course and identifier here is invented; the server is faked per test.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d21";
const LATE = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e521";
const EXTENDED = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e522";
const N1 = "00000000-0000-4000-8000-00000000f101";
const N2 = "00000000-0000-4000-8000-00000000f102";
const N3 = "00000000-0000-4000-8000-00000000f103";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/** A signed-in student with one late assignment and one whose extension still runs. */
async function student(page: Page) {
  const seen = { reads: [] as string[], enrolments: [] as unknown[] };
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij medija", assignments: [
      { id: LATE, title: "Sažetak izmišljenog članka", dueAt: "2026-01-10T10:00:00.000Z", noticeFirst: false },
      { id: EXTENDED, title: "Esej o izmišljenom gradu", dueAt: "2026-01-12T10:00:00.000Z", noticeFirst: false, extendedDueAt: "2099-12-31T22:59:00.000Z" },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({ json: { assignments: [] } }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({
    json: { notifications: [
      { id: N1, kind: "assignment_version", targetId: LATE, createdAt: "2026-11-20T08:00:00.000Z", readAt: null },
      // A kind the app does not know yet: skipped, not "unavailable".
      { id: N2, kind: "grade_published", targetId: LATE, createdAt: "2026-11-20T09:00:00.000Z", readAt: null },
      { id: N3, kind: "deadline_reminder", targetId: EXTENDED, createdAt: "2026-11-19T08:00:00.000Z", readAt: "2026-11-19T09:00:00.000Z" },
    ], nextBefore: null },
  }));
  await page.route("**/api/v1/notifications/*/read", (route) => {
    seen.reads.push(new URL(route.request().url()).pathname);
    expect(route.request().method()).toBe("POST");
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/student/enrollments", (route) => {
    seen.enrolments.push(route.request().postDataJSON());
    return route.fulfill({ status: 429, json: { code: "too_many_attempts" } });
  });
  return seen;
}

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`P-3: a passed deadline and a running extension are told apart on the home page (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await student(page);
      await page.goto("/aplikacija/zadaci");
      const late = page.getByRole("listitem").filter({ hasText: "Sažetak izmišljenog članka" });
      await expect(late.getByText("Rok je prošao 10. 1. 2026.")).toBeVisible();
      const extended = page.getByRole("listitem").filter({ hasText: "Esej o izmišljenom gradu" });
      await expect(extended.getByText("Produljeni rok: 31. 12. 2099., 23:59")).toBeVisible();
      await expect(extended.getByText("Izvorni rok je prošao 12. 1. 2026.")).toBeVisible();
      await expect(extended.getByText(/^Rok je prošao/)).toHaveCount(0);
      // E-2h: the row's link is described by its deadline line, so the tag is read with it.
      const open = late.getByRole("link", { name: "Otvori zadatak: Sažetak izmišljenog članka" });
      await expect(open).toHaveAccessibleDescription(/Rok je prošao 10\. 1\. 2026\./);
      await axe(page);
    });
  }
}

test("P-1: the bell counts only known unread kinds, opens the list, and marks an entry read on the way", async ({ page }) => {
  const seen = await student(page);
  await page.goto("/aplikacija/zadaci");
  const bell = page.getByRole("button", { name: "Obavijesti, nepročitanih: 1" });
  await expect(bell).toBeVisible();
  await bell.click();
  const list = page.getByRole("dialog", { name: "Popis obavijesti" });
  await expect(list.getByRole("link")).toHaveCount(2);
  await expect(list.getByRole("link", { name: /Nova verzija zadatka/ })).toBeVisible();
  await expect(list.getByRole("link", { name: /Rok za zadatak Esej o izmišljenom gradu: / })).toBeVisible();
  await axe(page);
  await list.getByRole("link", { name: /Nova verzija zadatka/ }).click();
  await expect(page).toHaveURL(new RegExp(`/aplikacija/zadatak/${LATE}$`));
  await expect.poll(() => seen.reads).toEqual([`/api/v1/notifications/${N1}/read`]);
});

test("P-1: an unavailable inbox says so and does not claim there are none", async ({ page }) => {
  await student(page);
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ status: 503, json: { code: "unavailable" } }));
  await page.goto("/aplikacija/zadaci");
  await page.getByRole("button", { name: "Obavijesti" }).click();
  await expect(page.getByRole("dialog", { name: "Popis obavijesti" })).toContainText("Obavijesti trenutačno nisu dostupne. To ne znači da ih nema.");
});

test("P-11 and P-10: the home card carries a clean code to E-5; too many attempts has its own text, apart from the field", async ({ page }) => {
  const seen = await student(page);
  await page.goto("/aplikacija/zadaci");
  const card = page.getByRole("region", { name: "Imate kod novog kolegija?" });
  const homeField = card.getByRole("textbox", { name: "Kod kolegija" });
  await expect(homeField).toHaveAttribute("maxlength", "32");
  await homeField.fill("kol-d 2026");
  await card.getByRole("button", { name: "Upiši" }).click();
  await expect(page).toHaveURL(/\/aplikacija\/upis\?kod=KOLD2026$/);
  const field = page.getByRole("textbox");
  await expect(field).toHaveValue("KOLD2026");
  await expect(field).toHaveAttribute("maxlength", "32");

  await page.getByRole("button", { name: "Upiši" }).click();
  const alert = page.getByRole("main").getByRole("alert").filter({ hasText: "Previše pokušaja" });
  await expect(alert).toHaveText("Previše pokušaja. Pričekajte malo i pokušajte ponovno ili se javite nastavniku.");
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue("KOLD2026");
  expect(seen.enrolments).toEqual([{ code: "KOLD2026" }]);
  await axe(page);
});

test("P-15: a refused sign-in has its own text, names the faculty administrator and offers no retry", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  await page.goto("/aplikacija/prijava?greska=login_refused");
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert.getByRole("heading", { level: 2 })).toHaveText("Prijava je odbijena");
  await expect(alert).toContainText("To nije kvar prijave i ponovni pokušaj ga neće promijeniti.");
  await expect(alert).toContainText("Javite se koordinatoru (administratoru fakulteta) na svojoj ustanovi.");
  await expect(alert.getByRole("link", { name: "Pokušaj ponovno" })).toHaveCount(0);
  await expect(alert.getByRole("link", { name: "Na početnu" })).toHaveAttribute("href", "/");
  await axe(page);

  await page.goto("/aplikacija/prijava?greska=provider_unavailable");
  await expect(page.getByRole("main").getByRole("alert").getByRole("heading", { level: 2 })).toHaveText("AAI@EduHr trenutačno ne odgovara");

  await page.goto("/aplikacija/prijava?stanje=bezuloge");
  const card = page.getByRole("status").filter({ hasText: "Prijava je uspjela" });
  await expect(card).toContainText("Ulogu dodjeljuje administrator fakulteta.");
});

test("P-1: the bell works from the keyboard: Enter opens the list, Tab reaches an entry, Escape closes it", async ({ page }) => {
  const seen = await student(page);
  await page.goto("/aplikacija/zadaci");
  const bell = page.getByRole("button", { name: "Obavijesti, nepročitanih: 1" });
  await bell.focus();
  await page.keyboard.press("Enter");
  const list = page.getByRole("dialog", { name: "Popis obavijesti" });
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(bell).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(list).toBeVisible();
  let reached = false;
  for (let i = 0; i < 4 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = await list.getByRole("link", { name: /Rok za zadatak Esej o izmišljenom gradu: / }).evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/aplikacija/zadatak/${EXTENDED}$`));
  await expect.poll(() => seen.reads).toEqual([`/api/v1/notifications/${N3}/read`]);
});
