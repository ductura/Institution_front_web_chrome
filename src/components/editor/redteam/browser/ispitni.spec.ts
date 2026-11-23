import { expect, test, type Page } from "@playwright/test";

import { cdpLayoutKey } from "./humanizer";

/**
 * Exam mode (P-4 proposal) in a real browser: text that was not typed does not
 * enter the work, and the page shows exactly what the editor holds. Chromium
 * only (CDP keys and clipboard); the config runs this file there alone. Every
 * text is invented.
 */

const ready = async (page: Page, query = "?exam=1") => {
  await page.goto("/" + query);
  await page.waitForFunction(() => window.__source?.ready === true);
  await page.locator("#editor .ProseMirror").click();
};
const text = (page: Page) => page.evaluate(() => window.__source!.text());
const domText = (page: Page) => page.evaluate(() => window.__source!.domText());
const refusals = (page: Page) => page.evaluate(() => window.__source!.refusals());

test.describe("ispitni način: dopušteno", () => {
  test("tipkanje prolazi", async ({ page }) => {
    await ready(page);
    await page.keyboard.type("Izmisljena recenica.", { delay: 20 });
    expect(await text(page)).toBe("Izmisljena recenica.");
    expect(await refusals(page)).toEqual([]);
  });

  test("hrvatska slova kao prave tipke prolaze", async ({ page }) => {
    await ready(page);
    const key = cdpLayoutKey(await page.context().newCDPSession(page));
    for (const ch of "Šuma ćuti, đak čita žito.") {
      if (/[čćžšđČĆŽŠĐ]/u.test(ch)) await key(ch);
      else await page.keyboard.type(ch);
    }
    expect(await text(page)).toBe("Šuma ćuti, đak čita žito.");
    expect(await refusals(page)).toEqual([]);
  });

  test("lijepljenje teksta kopiranog iz ovog rada prolazi", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await ready(page);
    await page.keyboard.type("vrt i klupa", { delay: 10 });
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("ControlOrMeta+C");
    await page.keyboard.press("End");
    await page.keyboard.press("ControlOrMeta+V");
    // A whole copied paragraph is pasted as a paragraph of its own.
    await expect.poll(async () => ((await text(page)).match(/vrt i klupa/g) ?? []).length).toBe(2);
    expect(await refusals(page)).toEqual([]);
  });

  test("poništi i ponovi rade", async ({ page }) => {
    await ready(page);
    await page.keyboard.type("abc", { delay: 10 });
    await page.waitForTimeout(700);
    await page.keyboard.type("d");
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => text(page)).toBe("abc");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect.poll(() => text(page)).toBe("abcd");
  });

  test("unos bez tipki uz odobrenu prilagodbu prolazi", async ({ page }) => {
    await ready(page, "?exam=1&accommodation=1");
    await page.keyboard.insertText("Diktirana izmisljena recenica.");
    expect(await text(page)).toBe("Diktirana izmisljena recenica.");
    expect(await refusals(page)).toEqual([]);
  });
});

test.describe("ispitni način: odbijeno, a stranica pokazuje isto što editor drži", () => {
  test("lijepljenje teksta izvana", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await ready(page);
    await page.evaluate(() => navigator.clipboard.writeText("Izmisljeni AI odgovor izvana."));
    await page.keyboard.press("ControlOrMeta+V");
    await expect.poll(() => refusals(page)).toEqual(["pasted-from-outside"]);
    expect(await text(page)).toBe("");
    expect(await domText(page)).toBe("");
  });

  test("unos bez tipki (diktat, ekstenzija s insertText)", async ({ page }) => {
    await ready(page);
    await page.keyboard.insertText("Izmisljeni tekst bez tipki.");
    await expect.poll(() => refusals(page)).toEqual(["keyless-input"]);
    expect(await text(page)).toBe("");
    expect(await domText(page)).toBe("");
  });

  test("skripta kroz API editora", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__source!.scripted("Izmisljeni tekst skripte."));
    await expect.poll(() => refusals(page)).toEqual(["program"]);
    expect(await text(page)).toBe("");
  });

  test("bez ispitnog načina isti unosi ulaze (kontrola)", async ({ page }) => {
    await ready(page, "");
    await page.keyboard.insertText("Izmisljeni tekst bez tipki.");
    expect(await text(page)).toBe("Izmisljeni tekst bez tipki.");
    expect(await refusals(page)).toEqual([]);
  });
});

test.describe("ispitni način: poznata granica", () => {
  // An extension with chrome.debugger or a program outside the browser sends trusted keys.
  test("tipke kroz CDP (chrome.debugger) prolaze kao tipkanje", async ({ page }) => {
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    for (const ch of "Izmisljeno.") {
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: 0 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, windowsVirtualKeyCode: 0 });
    }
    expect(await text(page)).toBe("Izmisljeno.");
    expect(await refusals(page)).toEqual([]);
  });
});
