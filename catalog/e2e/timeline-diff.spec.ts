import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the replay can be played, paused and scrubbed by keyboard", async ({ page }) => {
  const start = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
  await page.goto("/");
  const section = page.getByRole("region", { name: "Timeline", exact: true });
  const player = section.getByRole("group", { name: "Vremenska crta" }).filter({ has: page.locator("input:enabled") }).first();
  const slider = player.getByRole("slider", { name: "Korak nastanka" });
  const play = player.getByRole("button", { name: "Pokreni reprodukciju" });
  const pause = player.getByRole("button", { name: "Pauziraj reprodukciju" });

  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "Korak 1 od 3");
  await player.getByRole("button", { name: "Prethodni korak" }).press("Enter");
  await expect(slider).toHaveValue("0");
  await play.press("Space");
  await page.clock.runFor(900);
  await expect(slider).toHaveValue("1");
  await pause.press("Space");
  await page.clock.runFor(900);
  await expect(slider).toHaveValue("1");
  await slider.press("End");
  await expect(slider).toHaveValue("3");
  await play.press("Enter");
  await expect(slider).toHaveValue("0");
  await page.clock.runFor(900);
  await slider.press("ArrowRight");
  await page.clock.runFor(900);
  await expect(slider).toHaveValue("2");
  await player.getByRole("combobox", { name: "Brzina reprodukcije" }).selectOption("4");
  await play.press("Enter");
  await page.clock.runFor(225);
  await expect(play).toBeFocused();
  await expect(slider).toHaveValue("3");
  await expect(player.locator("xpath=ancestor::dd").getByText("Izmišljeni školski vrt raste.")).toBeVisible();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
});

for (const theme of ["dark", "light"]) {
  test(`timeline and diff pass axe in the ${theme} theme at 360 px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`/?theme=${theme}`);
    const diff = page.getByRole("group", { name: "Usporedba teksta" }).first();
    await expect(diff.locator("ins")).toHaveCSS("text-decoration-line", "underline");
    await expect(diff.locator("del")).toHaveCSS("text-decoration-line", "line-through");
    const { violations } = await new AxeBuilder({ page }).include("#Timeline").include("#DiffView")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
  });
}
