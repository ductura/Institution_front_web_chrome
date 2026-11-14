import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { CATALOG_STATES } from "../src/coverage";

const COMPONENTS = ["Button", "TextField", "SaveState", "Card"];
const WIDTHS = [1440, 1024, 768, 390, 360];
const THEMES = ["dark", "light"] as const;

async function open(page: Page, theme: (typeof THEMES)[number], width: number): Promise<string[]> {
  const foreign: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1:4174/")) foreign.push(r.url()); });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(theme === "light" ? "/?theme=light" : "/");
  await page.evaluate(async () => { await document.fonts.ready; });
  return foreign;
}

for (const theme of THEMES) {
  test.describe(`${theme} shell`, () => {
    test("shows every component in all five states, on the shell and on the white sheet", async ({ page }) => {
      const foreign = await open(page, theme, 1440);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const name of COMPONENTS) {
        const section = page.getByRole("region", { name });
        await expect(section.locator(".sheet[data-sheet-theme=light]")).toHaveCount(1);
        for (const state of CATALOG_STATES) await expect(section.getByText(state, { exact: true })).toHaveCount(2);
      }
      await expect(page.getByText(/^Spremljeno$/)).toHaveCount(0);
      expect(foreign).toEqual([]);
    });

    test("has no WCAG 2.2 AA violations (axe)", async ({ page }) => {
      for (const width of [1440, 360]) {
        await open(page, theme, width);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      }
    });

    for (const width of WIDTHS) {
      test(`matches its baselines at ${width} px`, async ({ page }) => {
        await open(page, theme, width);
        for (const name of COMPONENTS) {
          await expect(page.getByRole("region", { name })).toHaveScreenshot(`${name}-${theme}-${width}.png`);
        }
      });
    }
  });
}
