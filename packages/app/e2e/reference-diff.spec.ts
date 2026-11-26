// DAN-1565: the pixel difference behind the reference report, on drawn boxes:
// the same image differs nowhere, a changed quarter is a quarter, and an image
// of another size is told apart and counted over the larger area.
import { expect, test, type Page } from "@playwright/test";

import { diffImages } from "./reference-report/diff.ts";

async function draw(page: Page, width: number, height: number, quarter: string): Promise<string> {
  await page.setViewportSize({ width, height });
  await page.setContent(`<body style="margin:0;background:#fff">
    <div style="width:50%;height:50vh;background:${quarter}"></div></body>`);
  return (await page.screenshot()).toString("base64");
}

test("the difference of two images is the share of pixels that changed", async ({ page }) => {
  const white = await draw(page, 200, 100, "#fff");
  const black = await draw(page, 200, 100, "#000");
  const nearWhite = await draw(page, 200, 100, "#f8f8f8");
  const taller = await draw(page, 200, 200, "#fff");

  expect(await diffImages(page, white, white)).toMatchObject({ percent: 0, sameSize: true });
  expect(await diffImages(page, white, nearWhite)).toMatchObject({ percent: 0, sameSize: true });
  const changed = await diffImages(page, white, black);
  expect(changed).toMatchObject({ percent: 25, sameSize: true });
  expect(Buffer.from(changed.diffBase64, "base64").subarray(1, 4).toString()).toBe("PNG");
  expect(await diffImages(page, white, taller)).toMatchObject({ percent: 50, sameSize: false });
});
