// M1.8 (DAN-378): the no-access screen, in the three kinds, in both languages,
// opened without reading the session. Invented data only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Any read of the session would be a bug here: the screen is public. */
async function noSessionRead(page: Page) {
  const seen = { me: 0 };
  await page.route("**/api/v1/me", (route) => { seen.me += 1; return route.fulfill({ status: 401, json: {} }); });
  return seen;
}

test("403 leads to a screen that does not say whether the thing exists", async ({ page }) => {
  const seen = await noSessionRead(page);
  await page.goto("/app/web/nema-ovlasti?kind=denied");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nemate ovlasti za ovaj prikaz");
  await expect(page.getByRole("link", { name: /AAI@EduHr/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Na početnu" })).toHaveAttribute("href", "/app/web/");
  expect(seen.me).toBe(0);
  expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
});

test("an unknown kind shows the screen that reveals the least", async ({ page }) => {
  await noSessionRead(page);
  await page.goto("/app/web/nema-ovlasti?kind=bilo-sto");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nemate ovlasti za ovaj prikaz");
});

test("an ended session keeps unsent input on the device and offers AAI@EduHr sign-in", async ({ page }) => {
  await noSessionRead(page);
  await page.addInitScript(() => localStorage.setItem("ductura-unsent:/app/web/zadaci", "Izmišljeni neposlani tekst"));
  await page.goto("/app/web/nema-ovlasti?kind=expired&returnTo=%2Fzadaci");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prijava je istekla");
  await expect(page.getByText("Neposlani unos ostao je spremljen na uređaju")).toBeVisible();
  const signIn = page.getByRole("link", { name: "Prijavi se preko AAI@EduHr" });
  const href = new URL((await signIn.getAttribute("href"))!, "http://x");
  expect(href.pathname).toBe("/api/v1/auth/login");
  expect(href.searchParams.get("returnTo")).toBe("/app/web/zadaci");
  expect(await page.evaluate(() => localStorage.getItem("ductura-unsent:/app/web/zadaci"))).toBe("Izmišljeni neposlani tekst");
  expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
});

test("the sign-in link keeps the query of the page asked for", async ({ page }) => {
  await noSessionRead(page);
  await page.goto("/app/web/nema-ovlasti?kind=signedOut&returnTo=%2Fnastavnik%2Fzadatak%2Fnovi%3Fkolegij%3Dk1");
  const href = new URL((await page.getByRole("link", { name: "Prijavi se preko AAI@EduHr" }).getAttribute("href"))!, "http://x");
  expect(href.searchParams.get("returnTo")).toBe("/app/web/nastavnik/zadatak/novi?kolegij=k1");
});

test("without kept input the note is not shown", async ({ page }) => {
  await noSessionRead(page);
  await page.goto("/app/web/nema-ovlasti?kind=expired");
  await expect(page.getByText("Neposlani unos")).toHaveCount(0);
});

test("English text, from the saved interface language", async ({ page }) => {
  await noSessionRead(page);
  await page.addInitScript(() => localStorage.setItem("ductura.interface-locale", "en"));
  await page.goto("/app/web/nema-ovlasti?kind=signedOut");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign-in needed");
});
