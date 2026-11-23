// WEB-1805 (M11.6, D-276 NQ01, D-248, F-03): every main screen, for its role,
// passes axe without a critical or serious finding in both themes and at
// mobile width (criterion 1) and shows keyboard focus on every Tab stop
// (criterion 2). It also keeps a title of its own (WCAG 2.4.2) and reflows at
// 320 px (WCAG 1.4.10). One page load per screen, each check a step, so the
// pass runs with the app's e2e. Over the fake server of the "puno" scenario
// (VIZ-WCAG-LAZNI): every read answers from the contract's vectors, so axe sees
// each screen with its data, not its "cannot be read" state. Invented data only.
import { expect, test } from "@playwright/test";

import { otvori } from "../viz/otvori";
import { axe, hiddenFocus, setTheme } from "./check";
import { SCREENS } from "./screens";

for (const screen of SCREENS) {
  test(`${screen.name}: axe A/AA, title, reflow and visible focus`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1250, height: 900 });
    await otvori(page, screen, "puno");

    await test.step("title of its own (WCAG 2.4.2)", async () => {
      await expect(page).toHaveTitle(/^.+ · Ductura$/);
    });
    await test.step("axe, dark theme, 1250 px", () => axe(page, info, "dark-1250"));
    await test.step("keyboard focus is visible on every Tab stop", async () => {
      expect(await hiddenFocus(page)).toEqual([]);
    });
    await test.step("axe, light theme, 1250 px", async () => {
      await setTheme(page, "light");
      await axe(page, info, "light-1250");
    });
    await test.step("axe, dark theme, 400 px", async () => {
      await setTheme(page, "dark");
      await page.setViewportSize({ width: 400, height: 860 });
      await axe(page, info, "dark-400");
    });
    await test.step("at 320 px no horizontal scrolling (WCAG 1.4.10)", async () => {
      await page.setViewportSize({ width: 320, height: 640 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(0);
    });
  });
}
