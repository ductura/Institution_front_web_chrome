// WEB-1804 (M11.5, D-70): /profil over a fake institution server
// (page.route). The interface language is saved through
// profile.interface-locale.post and the whole shell changes language at once,
// with no new sign-in; dates and numbers follow it. Invented people only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const ME = { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } };

type Fake = { saved: string | null; posts: string[]; me: number; login: number; failSave?: number; readDelayMs?: number };

async function fakeServer(page: Page, fake: Fake) {
  await page.route("**/api/v1/me", async (route) => {
    fake.me += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) });
  });
  await page.route("**/api/v1/auth/login**", async (route) => {
    fake.login += 1;
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html lang=\"hr\"><title>AAI@EduHr</title></html>" });
  });
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({ json: { courses: [] } }));
  await page.route("**/api/v1/profile/interface-locale", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postData() ?? "";
      fake.posts.push(body);
      if (fake.failSave !== undefined) {
        await route.fulfill({ status: fake.failSave, contentType: "application/json", body: JSON.stringify({ error: fake.failSave === 401 ? "unauthorized" : "unavailable" }) });
        return;
      }
      fake.saved = (JSON.parse(body) as { locale: string }).locale;
    }
    // A read answers with the value as it was when asked, however long it takes.
    const asked = fake.saved;
    if (route.request().method() === "GET" && fake.readDelayMs !== undefined) await new Promise((done) => setTimeout(done, fake.readDelayMs));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locale: asked }) });
  });
}

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

test("switching to English saves it and changes the shell at once, without a new sign-in", async ({ page }) => {
  const errors = errorsOf(page);
  const fake: Fake = { saved: null, posts: [], me: 0, login: 0 };
  await fakeServer(page, fake);
  await page.goto("/app/web/profil");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Postavke profila");
  await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  await expect(page.getByText("Iva Izmišljena")).toBeVisible();
  await expect(page.getByText("21. studenoga 2026. u 14:05")).toBeVisible();
  await expect(page.getByText("1.234.567,5")).toBeVisible();
  await expect(page.getByText("Postavke obavijesti još nisu dostupne na poslužitelju ustanove.")).toBeVisible();
  await axe(page);

  await page.getByLabel("Jezik", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Spremi jezik" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile settings");
  await expect(page.getByRole("status").filter({ hasText: "The interface language is saved on the server." })).toBeVisible();
  expect(fake.posts).toEqual(['{"locale":"en"}']);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("21 November 2026 at 14:05")).toBeVisible();
  await expect(page.getByText("1,234,567.5")).toBeVisible();
  // The shell is in English too, and the session was not read again.
  await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "My assignments" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(fake.login).toBe(0);
  await expect(page).toHaveTitle("Profile settings · Ductura");
  await axe(page);

  // A new page load paints in the saved language.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile settings");
  expect(fake.login).toBe(0);
  expect(errors).toEqual([]);
});

test("the language saved on the server is used on another device", async ({ page }) => {
  const fake: Fake = { saved: "en", posts: [], me: 0, login: 0 };
  await fakeServer(page, fake);
  await page.goto("/app/web/zadaci");
  await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "My assignments" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Profile settings" }).click();
  await expect(page).toHaveURL(/\/app\/web\/profil$/);
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  expect(fake.posts).toEqual([]);
});

test("a save the server refuses keeps the language and says so", async ({ page }) => {
  const fake: Fake = { saved: null, posts: [], me: 0, login: 0, failSave: 503 };
  await fakeServer(page, fake);
  await page.goto("/app/web/profil");
  await page.getByLabel("Jezik", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Spremi jezik" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Jezik nije spremljen na poslužitelju. Pokušajte ponovno.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Postavke profila");
  await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  // The choice stays, so trying again sends English once more.
  await expect(page.getByLabel("Jezik", { exact: true })).toHaveValue("en");
  await page.getByRole("button", { name: "Spremi jezik" }).click();
  await expect.poll(() => fake.posts).toEqual(['{"locale":"en"}', '{"locale":"en"}']);
});

test("no saved language means Croatian, whatever the browser kept from another account", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("ductura.interface-locale", "en"); } catch { /* blocked */ } });
  const fake: Fake = { saved: null, posts: [], me: 0, login: 0 };
  await fakeServer(page, fake);
  await page.goto("/app/web/profil");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Postavke profila");
  await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  expect(await page.evaluate(() => localStorage.getItem("ductura.interface-locale"))).toBe("hr");
});

test("a slow first read does not undo a language saved meanwhile", async ({ page }) => {
  const fake: Fake = { saved: "hr", posts: [], me: 0, login: 0, readDelayMs: 2500 };
  await fakeServer(page, fake);
  await page.goto("/app/web/profil");
  await page.getByLabel("Jezik", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Spremi jezik" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile settings");
  // The read that started before the save answers "hr" now; English stays.
  await page.waitForTimeout(3000);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("on a narrow screen the settings link closes the navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  const fake: Fake = { saved: null, posts: [], me: 0, login: 0 };
  await fakeServer(page, fake);
  await page.goto("/app/web/zadaci");
  await page.getByRole("button", { name: "Izbornik" }).click();
  await page.getByRole("link", { name: "Postavke profila" }).click();
  await expect(page).toHaveURL(/\/app\/web\/profil$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Postavke profila");
  await expect(page.locator("main#sadrzaj")).not.toHaveAttribute("inert", /.*/);
  await page.getByLabel("Jezik", { exact: true }).selectOption("en");
});

test("an expired sign-in on save asks to sign in again instead of pretending", async ({ page }) => {
  const fake: Fake = { saved: null, posts: [], me: 0, login: 0, failSave: 401 };
  await fakeServer(page, fake);
  await page.goto("/app/web/profil");
  await page.getByLabel("Jezik", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Spremi jezik" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("AAI@EduHr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Postavke profila");
});
