// ED-77: "Sesija pisanja" at the foot of the right panel. A session started with a goal counts the words written,
// "Završi" shows the summary by chapter and the earlier sessions. The server is the VIZ "puno" scenario; every
// person and text is invented.
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

test("ED-77: a writing session counts the words written and sums them up", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await student(page);
  await page.goto(`/aplikacija/rad/${T1}`);
  await skipGuide(page);

  const sheet = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  const footer = page.locator("[data-writing-session]");
  await expect(footer).toContainText("cilj za danas");

  await footer.getByRole("button", { name: "Započni sesiju pisanja" }).click();
  const start = page.getByRole("dialog", { name: "Sesija pisanja" });
  await expect(start).toContainText("Sesije vidite samo Vi.");
  await start.getByRole("button", { name: "150", exact: true }).click();
  await start.getByRole("button", { name: "25 min", exact: true }).click();
  await start.getByRole("button", { name: "Započni", exact: true }).click();
  await expect(footer.getByRole("status")).toHaveText(/^Sesija\s*\+0 \/ 150 riječi, 0 \/ 25 min$/);

  await sheet.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Zamišljena rečenica od pet riječi.");
  await expect(footer.getByRole("status")).toContainText("+5 / 150 riječi");

  await footer.getByRole("button", { name: "Završi", exact: true }).click();
  const done = page.getByRole("dialog", { name: "Sesija je gotova" });
  await expect(done).toContainText("Napisano 5 riječi u 0 min.");
  await expect(done).toContainText("Do cilja je ostalo 145 riječi.");
  await expect(done.getByRole("heading", { name: "Prethodne sesije" })).toBeVisible();
  await expect(done).toContainText("+5 riječi, 0 min");
  await done.getByRole("button", { name: "Zatvori" }).click();
  await expect(footer.getByRole("button", { name: "Započni sesiju pisanja" })).toBeVisible();
});
