// ED-73: "Oblik rečenica" in the group Pregled draws one bar per sentence of the paragraph at the cursor.
// The server is the VIZ "puno" scenario; every person and text is invented.
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

test("ED-73: Oblik rečenica shows a bar for each sentence of the paragraph at the cursor", async ({ page }) => {
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
  await page.keyboard.insertText("Zamišljena prva rečenica ima šest riječi. Druga je kratka. Treća rečenica ima nešto više riječi od druge.");
  await expect(sheet).toContainText("Zamišljena prva rečenica");

  await page.getByRole("tab", { name: /Pregled/ }).click();
  const pregled = page.locator("[data-pregled]");
  await pregled.getByRole("button", { name: "Oblik rečenica", exact: true }).click();
  const bars = pregled.getByRole("list", { name: "Rečenice odlomka po duljini" }).getByRole("listitem");
  await expect(bars).toHaveCount(3);
  await expect(bars.nth(1)).toHaveAccessibleName("2. rečenica: 3 riječi");
  await expect(pregled.getByText("Izmjena kratkih i dugih rečenica čini tekst čitljivijim.")).toBeVisible();
});
