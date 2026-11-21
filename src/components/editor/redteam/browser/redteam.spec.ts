import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { cdpLayoutKey, play, plan, summary } from "./humanizer";

/**
 * Red-team "AI tipkač" for Ductura: an AI-written text typed into the
 * student editor as if a person typed it (human timing, typos, corrections,
 * pauses), through trusted key events. Checks which source label the
 * production `SourceObserver` (packages/editor-core) gives it, next to the
 * naive ways of getting AI text in. Every text is invented.
 *
 * Env:
 *   REDTEAM_TEXT_FILE  text to type (default: sample.txt beside this file)
 *   REDTEAM_SPEED      time factor (harness default 50 = 50x faster; live default 1)
 *   REDTEAM_WPM, REDTEAM_TYPO, REDTEAM_SEED   humanizer settings
 *   REDTEAM_URL        a running Ductura (local/staging) editor page: opens it
 *                      headed, waits for you to sign in and open a work, then
 *                      types in real time into the real evidence journal.
 */

const env = process.env;
const options = {
  wpm: Number(env.REDTEAM_WPM ?? 45),
  typoRate: Number(env.REDTEAM_TYPO ?? 0.03),
  seed: Number(env.REDTEAM_SEED ?? 1),
};

async function aiText(): Promise<string> {
  const file = env.REDTEAM_TEXT_FILE ?? fileURLToPath(new URL("./sample.txt", import.meta.url));
  return (await readFile(file, "utf8")).replace(/\r\n/g, "\n").trim();
}

const sources = (page: Page) => page.evaluate(() => window.__source!.sources());
const text = (page: Page) => page.evaluate(() => window.__source!.text());
const count = (list: string[]) =>
  Object.fromEntries([...new Set(list)].map((s) => [s, list.filter((x) => x === s).length]));

/** Croatian letters as real keys: through CDP in Chromium; elsewhere none (they arrive as text). */
async function layoutKey(page: Page, browserName: string) {
  if (browserName !== "chromium") return undefined;
  return cdpLayoutKey(await page.context().newCDPSession(page));
}

const results: { method: string; labels: Record<string, number>; caught: boolean }[] = [];

test.describe("red-team: AI tipkač (Ductura)", () => {
  test.skip(!!env.REDTEAM_URL, "REDTEAM_URL set: only the live run");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__source?.ready === true);
    await page.locator("#editor .ProseMirror").click();
  });

  // Playwright requires the first argument to be a destructuring pattern.
  test.afterAll(async ({}, testInfo) => {
    const rows = results.map((r) =>
      `| ${r.method} | ${Object.entries(r.labels).map(([k, v]) => `${k}: ${v}`).join(", ")} | ${r.caught ? "DA" : "**NE**"} |`);
    const report = [
      `# Red-team izvještaj (Ductura) — ${testInfo.project.name}`,
      "",
      "| Način unosa AI teksta | Oznake izvora (SourceObserver) | Označeno kao ne-tipkanje? |",
      "|---|---|---|",
      ...rows,
      "",
    ].join("\n");
    const dir = path.resolve("test-results");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `redteam-${testInfo.project.name}.md`), report);
    console.log(`\n${report}`);
  });

  test("AI tekst tipkan 'ljudski' (trusted tipke, tipfeleri, ispravci, pauze)", async ({ page, browserName }) => {
    test.setTimeout(600_000);
    const input = await aiText();
    const actions = plan(input, options);
    await play(page.keyboard, (ms) => page.waitForTimeout(ms), actions, Number(env.REDTEAM_SPEED ?? 50), await layoutKey(page, browserName));

    expect(await text(page)).toBe(input.replace(/\s*\n\s*/g, "\n\n"));
    const labels = await sources(page);
    results.push({
      method: `Ljudsko tipkanje ${JSON.stringify(summary(actions))}`,
      labels: count(labels),
      caught: labels.some((s) => s !== "editor"),
    });
    // The finding: every change is labelled exactly as a person's typing.
    expect(new Set(labels)).toEqual(new Set(["editor"]));
  });

  test("usporedba: lijepljenje (Ctrl+V)", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions: Chromium only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const input = (await aiText()).split("\n")[0];
    await page.evaluate((t) => navigator.clipboard.writeText(t), input);
    await page.keyboard.press("ControlOrMeta+V");
    await expect.poll(() => text(page)).toBe(input);
    const labels = await sources(page);
    results.push({ method: "Lijepljenje iz međuspremnika", labels: count(labels), caught: !labels.includes("editor") });
    expect(labels).toContain("paste");
  });

  test("usporedba: unos bez tipki (insertText, kao diktat/alat)", async ({ page }) => {
    const input = (await aiText()).split("\n")[0];
    await page.keyboard.insertText(input);
    const labels = await sources(page);
    results.push({ method: "Unos bez tipki (insertText)", labels: count(labels), caught: !labels.includes("editor") });
    expect(new Set(labels)).toEqual(new Set(["keyless-input"]));
  });

  test("usporedba: skripta kroz API editora", async ({ page }) => {
    const input = (await aiText()).split("\n")[0];
    await page.evaluate((t) => window.__source!.scripted(t), input);
    const labels = await sources(page);
    results.push({ method: "Skripta (API editora)", labels: count(labels), caught: !labels.includes("editor") });
    expect(new Set(labels)).toEqual(new Set(["unattributed"]));
  });
});

test.describe("red-team: živi rad u Ducturi", () => {
  test.skip(!env.REDTEAM_URL, "set REDTEAM_URL to a local or staging Ductura page");

  test("tipka AI tekst u pravi rad, u stvarnom vremenu", async ({ page, browserName }) => {
    test.setTimeout(0);
    const input = await aiText();
    const actions = plan(input, options);
    await page.goto(env.REDTEAM_URL!);
    console.log("Prijavi se i otvori rad; tipkanje počinje kad se pojavi editor.");
    const editor = page.locator(".ProseMirror").first();
    await editor.waitFor({ timeout: 0 });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    console.log(`Plan: ${JSON.stringify(summary(actions))}`);
    await play(page.keyboard, (ms) => page.waitForTimeout(ms), actions, Number(env.REDTEAM_SPEED ?? 1), await layoutKey(page, browserName));
    console.log("Gotovo. Provjeri u nastavničkom pregledu / replayu kako je rad označen.");
  });
});
