// ED-41 (P2-12): Sitnice in "Provjere" of the group Pregled. A slip typed in the work is listed with its
// "Prije i poslije", "Popravi" fixes it, and "Vrati" takes the fix back while the text is unchanged. The server
// is the VIZ "puno" scenario; every person and text is invented.
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

test("ED-41: Sitnice lists a slip with Prije i poslije, fixes it and Vrati takes the fix back", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await student(page);
  await page.goto(`/aplikacija/rad/${T1}`);
  await skipGuide(page);

  // A space before a comma: the editor keeps it as typed (a double space would be folded by the browser).
  const sheet = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Probni odlomak , za provjeru.");
  await expect(sheet).toContainText("Probni odlomak , za");

  await page.getByRole("tab", { name: /Pregled/ }).click();
  await page.getByRole("button", { name: "Provjere", exact: true }).click();
  const fixes = page.getByRole("region", { name: "Sitnice" });
  const item = fixes.getByRole("list", { name: "Sitnice u tekstu" }).getByRole("listitem").filter({ hasText: "Probni" });
  await expect(item).toContainText("Razmak ispred interpunkcije");

  await item.getByText("Prije i poslije").click();
  await expect(item.getByText("Prije:")).toBeVisible();
  await expect(item.locator("del")).toContainText("␣");
  await expect(item.locator("ins")).toHaveCount(0);

  await item.getByRole("button", { name: "Popravi" }).click();
  await expect(fixes.getByRole("status").filter({ hasText: "Popravljeno." })).toBeVisible();
  await expect(sheet).toContainText("Probni odlomak, za");
  await expect(item).toHaveCount(0);

  await fixes.getByRole("button", { name: "Vrati" }).click();
  await expect(fixes.getByRole("status").filter({ hasText: "Vraćeno kako je bilo." })).toBeVisible();
  await expect(sheet).toContainText("Probni odlomak , za");
  await expect(fixes.getByRole("button", { name: "Vrati" })).toHaveCount(0);
});
