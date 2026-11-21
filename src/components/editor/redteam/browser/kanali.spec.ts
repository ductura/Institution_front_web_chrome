import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * Red-team: two more channels, measured instead of estimated. Chromium only
 * (the config runs this file in the chromium project alone). Every text is
 * invented.
 *
 * - chrome.debugger: an extension with the debugger permission sends the same
 *   CDP command as here (Input.dispatchKeyEvent), so the page sees trusted
 *   keys. Chrome then shows a "debugging this browser" bar the page cannot read.
 * - A disguised Playwright: --disable-blink-features=AutomationControlled stops
 *   navigator.webdriver, which R-1 relies on.
 */

async function sampleLine(): Promise<string> {
  const text = await readFile(fileURLToPath(new URL("./sample.txt", import.meta.url)), "utf8");
  return text.replace(/\r\n/g, "\n").trim().split("\n")[0]!.slice(0, 120);
}
const sources = (page: Page) => page.evaluate(() => window.__source!.sources());
const text = (page: Page) => page.evaluate(() => window.__source!.text());

async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => window.__source?.ready === true);
  await page.locator("#editor .ProseMirror").click();
}

test.describe("red-team: tipke kroz CDP (chrome.debugger)", () => {
  test("bilježe se kao tipkanje osobe", async ({ page }) => {
    await open(page);
    const input = await sampleLine();
    const cdp = await page.context().newCDPSession(page);
    for (const ch of input) {
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: 0 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, windowsVirtualKeyCode: 0 });
    }
    expect(await text(page)).toBe(input);
    // The finding: indistinguishable from typing in the page.
    expect(new Set(await sources(page))).toEqual(new Set(["editor"]));
  });
});

test.describe("red-team: prikriveni Playwright", () => {
  test("R-1 ne vidi upravljani preglednik kad je oznaka isključena", async ({ baseURL }) => {
    // Its own browser with the stealth switch (launch options cannot change inside a describe).
    const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
    try {
      const page = await (await browser.newContext({ baseURL })).newPage();
      await open(page);
      expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
      await page.keyboard.type("Kratak izmisljeni tekst.");
      const rules = (await page.evaluate(() => window.__source!.flags())).map((f) => f.rule);
      expect(rules).not.toContain("R-1");
    } finally {
      await browser.close();
    }
  });
});
