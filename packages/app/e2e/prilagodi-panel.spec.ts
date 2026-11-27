// ED-39 (P2-8): the dialog "Prilagodi panel" chooses the side's width on a computer and its density. The
// width is the same choice as the shell's "Raspored" menu: a pick in one shows in the other at once and is
// kept after a reload. The server is the VIZ "puno" scenario; every person and text is invented.
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

test("ED-39: Prilagodi panel chooses the width (shared with Raspored) and the density, and keeps them", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await student(page);
  await page.goto(`/aplikacija/rad/${T1}`);
  await skipGuide(page);

  const rail = page.getByRole("complementary", { name: "Struktura rada" });
  await expect(rail).toBeVisible();
  const railWidth = async () => Math.round((await rail.boundingBox())?.width ?? 0);
  const before = await railWidth();

  await page.getByRole("button", { name: "Prilagodi panel", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Prilagodi panel" });
  await expect(dialog.getByText("Postavke vrijede samo za Vas")).toBeVisible();
  const width = dialog.getByRole("group", { name: "Širina na računalu" });
  await expect(width.getByRole("button", { name: "Srednja" })).toHaveAttribute("aria-pressed", "true");
  await width.getByRole("button", { name: "Široka" }).click();
  await expect(width.getByRole("button", { name: "Široka" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(railWidth).toBeGreaterThan(before);

  const density = dialog.getByRole("group", { name: "Gustoća" });
  await expect(density.getByRole("button", { name: "Prozračno" })).toHaveAttribute("aria-pressed", "true");
  await density.getByRole("button", { name: "Zbijeno" }).click();
  await expect(density.getByRole("button", { name: "Zbijeno" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Gotovo" }).click();

  // The shell's menu shows the same choice without a reload.
  await page.getByText("Raspored ▾").click();
  await expect(page.getByRole("group", { name: "Širina na računalu: Struktura" }).getByRole("button", { name: "Široka" }))
    .toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await skipGuide(page);
  await expect(rail).toBeVisible();
  await expect.poll(railWidth).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Prilagodi panel", exact: true }).click();
  await expect(dialog.getByRole("group", { name: "Gustoća" }).getByRole("button", { name: "Zbijeno" })).toHaveAttribute("aria-pressed", "true");

  // "Vrati zadano" brings back the medium width and the airy density.
  await dialog.getByRole("button", { name: "Vrati zadano" }).click();
  await expect(dialog.getByRole("group", { name: "Širina na računalu" }).getByRole("button", { name: "Srednja" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("group", { name: "Gustoća" }).getByRole("button", { name: "Prozračno" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(railWidth).toBe(before);
});
