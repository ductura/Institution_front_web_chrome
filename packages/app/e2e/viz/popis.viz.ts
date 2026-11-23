// VIZ alat (graditelj): which prototype screens and states have an app pair.
// Each prototype lists its screens and their states in the proto-bar
// selects; this walks them and writes viz-out/popis.json, which the report
// turns into a coverage table (izvjestaj.ts).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";

import { PAIRS, VIZ_OUT } from "./pairs";

const OUT = VIZ_OUT;
// The prototypes are in the repository (docs/prototip); VIZ_PROTOTIPOVI points elsewhere.
const PROTOTIPOVI_ZADANO = resolve(import.meta.dirname, "../../../../docs/prototip");
const PROTOTIPOVI = resolve(process.env.VIZ_PROTOTIPOVI ?? PROTOTIPOVI_ZADANO);
const FILES = ["Ductura_student.html", "Ductura_nastavnik.html", "editor/index.html"];

export type Stavka = { readonly file: string; readonly hash: string; readonly naslov: string; readonly stanja: readonly string[]; readonly par: string | null };

test("popis prototipa", async ({ page }) => {
  const stavke: Stavka[] = [];
  const par = (file: string, hash: string) =>
    PAIRS.find(({ proto }) => proto !== null && proto.file === file && (proto.hash ?? "") === hash)?.screen.name ?? null;
  for (const file of FILES) {
    const path = resolve(PROTOTIPOVI, file);
    if (!existsSync(path)) continue;
    await page.goto(pathToFileURL(path).href);
    await page.waitForLoadState("networkidle");
    const ekrani = await page.locator("#proto-view option").evaluateAll((os) =>
      os.map((o) => ({ hash: (o as HTMLOptionElement).value, naslov: o.textContent ?? "" })));
    if (ekrani.length === 0) {
      stavke.push({ file, hash: "", naslov: file, stanja: [], par: par(file, "") });
      continue;
    }
    for (const { hash, naslov } of ekrani) {
      await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForTimeout(50);
      const stanja = await page.locator("#proto-variant option").evaluateAll((os) => os.map((o) => o.textContent ?? ""));
      stavke.push({ file, hash, naslov, stanja, par: par(file, hash) });
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, "popis.json"), JSON.stringify(stavke, null, 1));
});
