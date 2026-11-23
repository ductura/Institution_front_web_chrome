// VIZ alat (graditelj): the app and its prototype, one screenshot per width,
// side by side in viz-out/index.html, with a diff image and the share of
// differing pixels (razlika.ts). A difference fails only above the threshold
// VIZ_PRAG in % (prag.ts; the target is 2), checked after the run in
// izvjestaj.ts; without it nothing fails. Not in ci.yml (workflow viz-usporedba,
// by hand). Run: pnpm viz, or
// pnpm viz --grep "student: rad".
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";

import { axe, setTheme } from "../a11y/check";
import { otvori } from "./otvori";
import { PAIRS, SCENARIJ, VIZ_OUT, WIDTHS } from "./pairs";
import { razlika } from "./razlika";

const OUT = VIZ_OUT;
// The prototypes are in the repository (docs/prototip); VIZ_PROTOTIPOVI points elsewhere.
const PROTOTIPOVI_ZADANO = resolve(import.meta.dirname, "../../../../docs/prototip");
const PROTOTIPOVI = resolve(process.env.VIZ_PROTOTIPOVI ?? PROTOTIPOVI_ZADANO);
const THEME = process.env.VIZ_THEME === "dark" ? "dark" : "light";
/** Content that changes between runs (dates, generated names) is painted over in both shots. */
const MASK = "[data-viz-mask]";

for (const { screen, proto, slug } of PAIRS) {
  for (const width of WIDTHS) {
    const app = `${OUT}/${slug}/app-${width}.png`;
    test(`${screen.name} · ${width} · aplikacija`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await otvori(page, screen, SCENARIJ);
      await setTheme(page, THEME);
      // VIZ-CSS (b): the shot waits for the fonts, so no fallback face is compared.
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: app, fullPage: true, mask: [page.locator(MASK)] });
      // VIZ-CSS (c): axe on every screen of the pass, after the shot so a finding never loses it;
      // critical and serious findings fail the test (a contrast fix goes into a token, never into this call).
      await axe(page, info, `${slug}-${width}`);
    });

    if (proto === null) continue;
    // Runs after the app test (workers: 1, file order), so app-<w>.png exists.
    test(`${screen.name} · ${width} · prototip`, async ({ page }) => {
      const file = resolve(PROTOTIPOVI, proto.file);
      test.skip(!existsSync(file), `nema prototipa ${file} (VIZ_PROTOTIPOVI)`);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(file).href + (proto.hash ? `#${proto.hash}` : ""));
      await page.waitForLoadState("networkidle");
      await page.locator("html").evaluate((html, theme) => html.setAttribute("data-theme", theme), THEME);
      // The prototype's own screen/state switcher is not part of the design.
      await page.addStyleTag({ content: "#proto-bar{display:none!important}" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const shot = `${OUT}/${slug}/proto-${width}.png`;
      await page.screenshot({ path: shot, fullPage: true, mask: [page.locator(MASK)] });
      if (existsSync(app)) {
        await razlika(page, app, shot, { png: `${OUT}/${slug}/razlika-${width}.png`, json: `${OUT}/${slug}/razlika-${width}.json` });
      }
    });
  }
}
