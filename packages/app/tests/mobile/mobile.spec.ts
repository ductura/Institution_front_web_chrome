// WEB-1806 (M11.10): at 360 px every main screen has no horizontal scrolling,
// and the two pages of this task work there: "Prijavi problem" (no work content
// leaves the form) and "Kako Ductura radi". Over the fake institution server of
// the accessibility pass; invented data only.
import { expect, test, type Page } from "@playwright/test";

import { open } from "../../e2e/a11y/check";
import { SCREENS } from "../../e2e/a11y/screens";

const WIDTH = 360;

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const screen of SCREENS) {
  test(`${screen.name}: no horizontal scrolling at ${WIDTH} px`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 740 });
    await open(page, screen);
    await expect.poll(() => overflow(page)).toBeLessThanOrEqual(0);
  });
}

test("kako Ductura radi: says what is recorded, what is not and who sees what, at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 740 });
  await open(page, { name: "kako radi", path: "/kako-radi", role: "student" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kako");
  await expect(page.getByRole("heading", { name: "Što se bilježi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Što se ne bilježi/ })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect.poll(() => overflow(page)).toBeLessThanOrEqual(0);
});

test("prijavi problem: the form says the work's content is not sent, and sends no more than six keys", async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 740 });
  await open(page, { name: "moji zadaci", path: "/zadaci", role: "student" });
  const sent: unknown[] = [];
  // The route is not in the contract yet (TODO(ugovor)), so the client refuses before any request.
  page.on("request", (request) => {
    if (request.url().includes("/support/problem-report")) sent.push(request.postDataJSON());
  });
  await page.getByRole("button", { name: "Otvori navigaciju" }).click();
  await page.getByRole("button", { name: "Prijavi problem" }).click();
  const dialog = page.getByRole("dialog", { name: "Prijavi problem" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Sadržaj Vašeg rada se ne šalje.")).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(1);
  await expect.poll(() => overflow(page)).toBeLessThanOrEqual(0);
  await dialog.getByRole("textbox", { name: "Opis" }).fill("Izmišljeni opis: gumb za spremanje ne reagira.");
  await dialog.getByRole("button", { name: "Pošalji prijavu" }).click();
  for (const body of sent) expect(Object.keys(body as object).sort()).toEqual(["appVersion", "browser", "category", "description", "route", "syncState"]);
  // Whatever the answer, the description stays in the form unless the report was received.
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

