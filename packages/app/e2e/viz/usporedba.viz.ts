// VIZ alat (graditelj): the app and its prototype, one screenshot per width,
// side by side in viz-out/index.html. Only a report: nothing is compared by
// pixel and nothing fails on a difference. Not in CI (the prototypes are not
// in the repository). Run: pnpm viz, or pnpm viz --grep "student: rad".
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";

import { open, setTheme } from "../a11y/check";
import { PAIRS, WIDTHS } from "./pairs";

const OUT = resolve(import.meta.dirname, "../../viz-out");
const PROTOTIPOVI = resolve(process.env.VIZ_PROTOTIPOVI ?? "D:/Ductura/_prototipovi");
const THEME = process.env.VIZ_THEME === "dark" ? "dark" : "light";

for (const { screen, proto, slug } of PAIRS) {
  for (const width of WIDTHS) {
    test(`${screen.name} · ${width} · aplikacija`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, screen);
      await setTheme(page, THEME);
      await page.screenshot({ path: `${OUT}/${slug}/app-${width}.png`, fullPage: true });
    });

    if (proto === null) continue;
    test(`${screen.name} · ${width} · prototip`, async ({ page }) => {
      const file = resolve(PROTOTIPOVI, proto.file);
      test.skip(!existsSync(file), `nema prototipa ${file} (VIZ_PROTOTIPOVI)`);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(file).href + (proto.hash ? `#${proto.hash}` : ""));
      await page.waitForLoadState("networkidle");
      await page.locator("html").evaluate((html, theme) => html.setAttribute("data-theme", theme), THEME);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${slug}/proto-${width}.png`, fullPage: true });
    });
  }
}
