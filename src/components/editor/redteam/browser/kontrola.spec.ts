import { expect, test, type Page } from "@playwright/test";

import { cdpLayoutKey } from "./humanizer";

/**
 * Control tests for the P-2 review flags (docs/ductus/USTAV-DOPUNA-P2.md §4,
 * draft N-4): allowed input must not be flagged. Dictation and an on-screen
 * keyboard arrive as `keyless-input` and are not subject to R-1 to R-4; a
 * person writing with pauses and going back is not flagged; Croatian letters
 * typed as keys are typing. Every text is invented.
 *
 * R-1 (navigator.webdriver) fires in every Playwright run because Playwright
 * sets it (P-2 §7); it is a property of the test, so these checks look only at
 * R-2 and R-3. Timing is real time: the rules read performance.now().
 */

type Flag = { rule: string; reason: string; burst?: number };

const ready = async (page: Page) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__source?.ready === true);
  await page.locator("#editor .ProseMirror").click();
};
const sources = (page: Page) => page.evaluate(() => window.__source!.sources());
const p2Flags = async (page: Page): Promise<Flag[]> =>
  (await page.evaluate(() => window.__source!.flags())).filter((f: Flag) => f.rule !== "R-1");

const SENTENCES = [
  "Izmišljeni grad na rijeci imao je tri mosta i jednu staru tržnicu na kojoj se prodavalo voće.",
  "Svako jutro ribari su donosili ulov, a djeca su trčala između štandova i brojala galebove.",
  "Kad je došla zima, rijeka se zaledila pa su ljudi prelazili pješice od jedne obale do druge.",
  "Stari knjižničar zapisivao je sve te priče u bilježnicu koju nitko osim njega nije čitao.",
  "Nakon mnogo godina bilježnica je pronađena u podrumu i postala je najvažnija knjiga u gradu.",
];

test.describe("kontrola P-2: dopušteni unos ne dobiva oznaku", () => {
  test.beforeEach(async ({ page }) => ready(page));

  test("diktat: dugi tekst u odlomcima bez tipki", async ({ page }) => {
    test.setTimeout(60_000);
    for (const sentence of SENTENCES) {
      await page.keyboard.insertText(`${sentence} `);
      await page.waitForTimeout(1500);
    }
    expect(new Set(await sources(page))).toEqual(new Set(["keyless-input"]));
    expect(await p2Flags(page)).toEqual([]);
  });

  test("zaslonska tipkovnica: znak po znak bez tipki", async ({ page }) => {
    test.setTimeout(120_000);
    for (const ch of SENTENCES.join(" ")) {
      await page.keyboard.insertText(ch);
      await page.waitForTimeout(25);
    }
    expect(new Set(await sources(page))).toEqual(new Set(["keyless-input"]));
    expect(await p2Flags(page)).toEqual([]);
  });

  test("osoba piše s razmišljanjem i vraća se u tekst", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Croatian letters as keys: Chromium (CDP) only");
    test.setTimeout(240_000);
    const key = cdpLayoutKey(await page.context().newCDPSession(page));
    const typeSentence = async (sentence: string) => {
      for (const ch of sentence) {
        if (/[čćžšđČĆŽŠĐ]/u.test(ch)) await key(ch);
        else await page.keyboard.type(ch);
        await page.waitForTimeout(60);
      }
    };
    for (const [i, sentence] of SENTENCES.entries()) {
      await typeSentence(`${sentence} `);
      // Thinking between sentences.
      await page.waitForTimeout(2600);
      if (i === 2) {
        // Back to the start to add a word, then on.
        await page.keyboard.press("ControlOrMeta+Home");
        await typeSentence("Nekada ");
        await page.keyboard.press("ControlOrMeta+End");
        await page.waitForTimeout(1200);
      }
    }
    expect(new Set(await sources(page))).toEqual(new Set(["editor"]));
    expect(await p2Flags(page)).toEqual([]);
  });

  test("hrvatska slova kao tipke su tipkanje, kratki tekst nije oznaka", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Croatian letters as keys: Chromium (CDP) only");
    const key = cdpLayoutKey(await page.context().newCDPSession(page));
    for (const ch of "Čađava šuma, žuti ćuk i đak što čita.") {
      if (/[čćžšđČĆŽŠĐ]/u.test(ch)) await key(ch);
      else await page.keyboard.type(ch);
      await page.waitForTimeout(40);
    }
    expect(new Set(await sources(page))).toEqual(new Set(["editor"]));
    expect(await p2Flags(page)).toEqual([]);
  });

  test("lijepljenje dugog teksta nije ritam (označeno kao paste, ne R-2/R-3)", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions: Chromium only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate((t) => navigator.clipboard.writeText(t), SENTENCES.join(" "));
    await page.keyboard.press("ControlOrMeta+V");
    await expect.poll(() => sources(page)).toContain("paste");
    expect(await p2Flags(page)).toEqual([]);
  });
});

test.describe("kontrola P-2: poznate lažne oznake s privremenim pragovima", () => {
  test.beforeEach(async ({ page }) => ready(page));

  // A careful typist: 470 characters, no typo, no going back, pauses under
  // 2 s. With the placeholder thresholds (400 characters, 2 s) R-2 and R-3
  // fire. This pins why the thresholds must come from samples of people
  // (P-2 §5) and may not be switched on before: the test turns red the day
  // the calibrated thresholds stop flagging it, and is then turned around.
  test("pažljiva osoba bez tipfelera i bez povratka dobiva R-2 i R-3", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Croatian letters as keys: Chromium (CDP) only");
    test.setTimeout(120_000);
    const key = cdpLayoutKey(await page.context().newCDPSession(page));
    for (const sentence of SENTENCES) {
      for (const ch of `${sentence} `) {
        if (/[čćžšđČĆŽŠĐ]/u.test(ch)) await key(ch);
        else await page.keyboard.type(ch);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(1500);
    }
    const rules = new Set((await p2Flags(page)).map((f) => f.rule));
    expect(rules).toEqual(new Set(["R-2", "R-3"]));
  });
});
