// ED-74: the prototype's tools in the group Pregled (Šavovi, Ponavljanja, Dosljednost, Brojke bez izvora,
// Doslovni navodi). A paragraph typed in the work shows up in Brojke bez izvora and Dosljednost, and a row
// jumps back to it. The server is the VIZ "puno" scenario; every person and text is invented.
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

async function student(page: Page) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const result = server.answer("student", req.method(), new URL(req.url()).pathname);
    return result === "hang" ? undefined : route.fulfill(result);
  });
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

test("ED-74: Pregled lists numbers without a source and mixed notation, and a row jumps to the paragraph", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await student(page);
  await page.goto(`/aplikacija/rad/${T1}`);
  await skipGuide(page);

  const sheet = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Zamišljeni uzorak brojao je 47 ispitanika, udio 5 % i 7% kasnije.");
  await expect(sheet).toContainText("Zamišljeni uzorak");
  await page.keyboard.press("Control+Home");

  await page.getByRole("tab", { name: /Pregled/ }).click();
  const pregled = page.locator("[data-pregled]");
  await pregled.getByRole("button", { name: "Cijeli rad", exact: true }).click();

  await pregled.getByRole("button", { name: "Brojke bez izvora", exact: true }).click();
  const row = pregled.getByRole("button").filter({ hasText: "Zamišljeni uzorak" });
  await expect(row).toContainText("47 ispitanik");
  await row.click();
  await expect(sheet).toBeFocused();

  await pregled.getByRole("button", { name: "Dosljednost", exact: true }).click();
  await expect(pregled.getByText("Isto zapisano na više načina.", { exact: false })).toBeVisible();
  await expect(pregled.getByRole("heading", { name: "Postotak" })).toBeVisible();

  await pregled.getByRole("button", { name: "Šavovi", exact: true }).click();
  await expect(pregled.getByText("Kraj jednog i početak sljedećeg poglavlja.", { exact: false })).toBeVisible();

  await pregled.getByRole("button", { name: "Doslovni navodi", exact: true }).click();
  await expect(pregled.getByText("Najdulji navodi")).toBeVisible();
});
