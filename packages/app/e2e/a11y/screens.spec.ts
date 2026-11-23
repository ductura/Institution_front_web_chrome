// WEB-1805 (M11.6, D-276 NQ01, D-248, F-03): every main screen, for its role,
// passes axe without a critical or serious finding in both themes and at
// mobile width (criterion 1) and shows keyboard focus on every Tab stop
// (criterion 2). It also keeps a title of its own (WCAG 2.4.2), headings that
// never skip a level (1.3.1), a first Tab stop that skips to the content
// (2.4.1, VIZ-WCAG N3/N4) and reflows at 320 px (WCAG 1.4.10). One page load per screen, each check a step, so the
// pass runs with the app's e2e. Over a fake institution server; invented data only.
import { expect, test } from "@playwright/test";

import { axe, hiddenFocus, open, setTheme } from "./check";
import { SCREENS } from "./screens";

for (const screen of SCREENS) {
  test(`${screen.name}: axe A/AA, title, reflow and visible focus`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1250, height: 900 });
    await open(page, screen);

    await test.step("title of its own (WCAG 2.4.2)", async () => {
      await expect(page).toHaveTitle(/^.+ · Ductura$/);
    });
    await test.step("headings never skip a level (WCAG 1.3.1)", async () => {
      const skips = await page.evaluate(() => {
        const shown = [...document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")]
          .filter((h) => h.getClientRects().length > 0 && getComputedStyle(h).visibility !== "hidden");
        const found: string[] = [];
        let last = 0;
        for (const h of shown) {
          const level = Number(h.tagName[1]);
          if (level > last + 1) found.push(`h${last} → ${h.tagName.toLowerCase()} „${h.textContent?.trim().slice(0, 40)}”`);
          last = level;
        }
        return found;
      });
      expect(skips).toEqual([]);
    });
    await test.step("the first Tab stop skips to the content (WCAG 2.4.1)", async () => {
      // Start from the top of the document, as after a fresh load: a field the
      // screen focuses on its own would otherwise be where Tab starts.
      await page.evaluate(() => {
        const body = document.body;
        body.tabIndex = -1;
        body.focus();
        body.removeAttribute("tabindex");
        window.scrollTo(0, 0);
      });
      await page.keyboard.press("Tab");
      const skip = page.locator(":focus");
      await expect(skip).toHaveText("Preskoči na sadržaj");
      await expect(skip).toHaveAttribute("href", "#sadrzaj");
      await expect(page.locator("#sadrzaj")).toHaveCount(1);
      await page.keyboard.press("Enter");
      await expect(page.locator("#sadrzaj")).toBeFocused();
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
