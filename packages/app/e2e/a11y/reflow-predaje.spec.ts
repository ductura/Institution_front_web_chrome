// VIZ-WCAG-MOB (VIZ-WCAG N1, N2): the teacher's submissions page reflows at 320 and 390 px (WCAG 1.4.10)
// and the PDF/DOCX choice of the bulk download is a target of at least 24 px with space between (2.5.8).
// The page is opened in the VIZ "puno" scenario, where the table has rows. Invented data only.
import { expect, test } from "@playwright/test";

import { otvori } from "../viz/otvori";
import { ASSIGNMENT_ID } from "./fake-server";
import type { Screen } from "./screens";

const SUBMISSIONS: Screen = { name: "nastavnik: predaje zadatka", path: `/nastavnik/zadatak/${ASSIGNMENT_ID}/predaje`, role: "teacher" };

for (const width of [320, 390]) {
  test(`the submissions page reflows at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await otvori(page, SUBMISSIONS, "puno");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);

    const options = page.locator("fieldset label");
    await expect(options).toHaveCount(2);
    const [pdf, docx] = [await options.nth(0).boundingBox(), await options.nth(1).boundingBox()];
    expect(pdf!.height).toBeGreaterThanOrEqual(24);
    expect(docx!.height).toBeGreaterThanOrEqual(24);
    const apart = docx!.y >= pdf!.y + pdf!.height || docx!.x >= pdf!.x + pdf!.width + 8;
    expect(apart).toBe(true);
  });
}
