// WEB-1805 (M11.6, D-276 NQ01, D-248, F-03): every main screen, for its role,
// passes axe without a critical or serious finding in both themes and at
// mobile width (criterion 1), and shows keyboard focus on every Tab stop
// (criterion 2). Over a fake institution server; invented data only.
import { expect, test } from "@playwright/test";

import { axe, hiddenFocus, open } from "./check";
import { SCREENS } from "./screens";

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test("axe, dark theme, 1250 px", async ({ page }, info) => {
      await page.setViewportSize({ width: 1250, height: 900 });
      await open(page, screen, "dark");
      await axe(page, info);
    });

    test("axe, light theme, 1250 px", async ({ page }, info) => {
      await page.setViewportSize({ width: 1250, height: 900 });
      await open(page, screen, "light");
      await axe(page, info);
    });

    test("axe, dark theme, 400 px", async ({ page }, info) => {
      await page.setViewportSize({ width: 400, height: 860 });
      await open(page, screen, "dark");
      await axe(page, info);
    });

    test("the page has a title of its own (WCAG 2.4.2)", async ({ page }) => {
      await open(page, screen, "dark");
      await expect(page).toHaveTitle(/^.+ · Ductura$/);
    });

    test("keyboard focus is visible on every Tab stop", async ({ page }) => {
      await page.setViewportSize({ width: 1250, height: 900 });
      await open(page, screen, "dark");
      expect(await hiddenFocus(page)).toEqual([]);
    });
  });
}
