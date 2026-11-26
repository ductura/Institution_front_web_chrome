// ED-21 (NF2-P21): Izvori are reachable without a mouse and axe finds nothing in them; the recovery offer is a
// status region that exists before its text does. History and the submission steps have their own axe specs
// (work-history, restore-diff, viz-puno-predaja). The server is the VIZ "puno" scenario; every text is invented.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

async function openEditor(page: Page) {
  const generated = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const result = generated.answer("student", req.method(), new URL(req.url()).pathname);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  await page.goto(`/aplikacija/rad/${T1}`);
  const sheet = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
  return sheet;
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`ED-21 Pristupačnost izvora, ${theme}`, () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("citations without a source are listed and worked with the keyboard alone", async ({ page }, info) => {
      const sheet = await openEditor(page);
      await setTheme(page, theme);
      await sheet.click();
      await page.keyboard.press("Control+End");
      await page.keyboard.insertText(" Izmišljena tvrdnja [izvor] i izmišljeni navod (Horvat, 2021).");
      const places = page.getByRole("region", { name: "Navodi bez izvora (2)" });
      await expect(places).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Navodi bez izvora: 2" })).toHaveCount(1);
      await axe(page, info, `izvori-navodi-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);

      // A keyboard press is what assistive technology sends: "Dodaj izvor" must answer it like a click.
      await places.getByRole("button", { name: "Dodaj izvor" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "Odustani" }).first()).toBeVisible();
      await axe(page, info, `izvori-dodaj-${theme}`);
    });
  });
}

test("the recovery offer is a status region before it has text", async ({ page }) => {
  await openEditor(page);
  const offer = page.locator("[data-recovery-offer]").first();
  await expect(offer).toHaveAttribute("role", "status");
  await expect(offer).toBeEmpty();
});
