import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { extractUiText as fromScan, isUiTextModule as isUiTextModuleFromScan } from "./scan.ts";
import { PHRASE_BREAK, closedUpPastQuotes, findForbiddenTerms, findForbiddenTermsInMarkup, windowsCutShort, MAX_WINDOW_PARTS } from "./terms.ts";
import { UI_TEXT_MODULES, extractUiText, findUiTextModules, isUiTextModule, scanUiTextModules } from "./ui-text.ts";

// Ported from Ductus tests/unit/forbidden-terms.test.ts at 0cdb0f1f ("lists the modules whose every string is read",
// "reads every catalogue value but not keys or imports", the markup readings), for the Ductura paths and dictionary.
// Every text is invented.

const REPO = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("UI text modules", () => {
  it("are the names the copied Ductus tests import from scan.ts", () => {
    expect(isUiTextModuleFromScan).toBe(isUiTextModule);
    expect(fromScan).toBe(extractUiText);
  });

  it("lists the modules whose every string is read", () => {
    expect(UI_TEXT_MODULES).toEqual([
      "src/lib/i18n/**",
      "**/labels.ts",
      "**/messages.ts",
      "**/copy.ts",
      "**/messages.hr.ts",
      "packages/editor-core/src/editor/schema.ts",
    ]);
    for (const file of [
      "src/lib/i18n/messages.hr.ts",
      "src/lib/i18n/messages.en.ts",
      "src/lib/i18n/demo-work.hr.ts",
      "src/lib/i18n/demo-fast-path.hr.ts",
      "src/lib/i18n/plural/rules.ts",
      "src/lib/i18n/table.json",
      "packages/editor-core/src/sync/labels.ts",
      "packages/editor-core/src/serverSync/messages.ts",
      "labels.ts",
      "src/components/how-it-works/copy.ts",
      "packages/editor-core/src/editor/schema.ts",
    ]) {
      expect(isUiTextModule(file), file).toBe(true);
    }
    for (const file of [
      "src/lib/i18n/messages.en.test.ts",
      "src/lib/i18n/landing.test.ts",
      "src/lib/i18n/types.d.ts",
      "src/lib/i18n/README.md",
      "packages/editor-core/src/sync/states.ts",
      "packages/editor-core/src/sync/sync-labels.ts",
      "packages/editor-core/src/sync/labels.tsx",
      "packages/editor-core/src/serverSync/bootstrap.ts",
      "packages/editor-core/src/editor/schema.ts.bak",
      "src/editor/schema.ts",
      "tests/lib/i18n/hr.ts",
      "lib/i18n/hr.ts",
      "src/lib/i18nx/hr.ts",
    ]) {
      expect(isUiTextModule(file), file).toBe(false);
    }
  });

  it("reads every catalogue value but not keys, imports or literal types", () => {
    const source = `
      import { plural } from "./hidden-helpers";
      export { other } from "./saved-elsewhere";
      type Kind = "hidden" | "saved";
      export const messages = { "status.hidden": "Praznina u zapisu", saved: \`Spremljeno \${place}\`, ["risk"]: "Rok" };`;
    const texts = extractUiText("src/lib/i18n/messages.ts", source, "catalogue").map((entry) => entry.text);
    expect(texts).toEqual(["Praznina u zapisu", "Spremljeno  ", "Rok"]);
  });

  it("reads a + chain as one text and every literal by itself, with the line it starts on", () => {
    const source = 'export const a = 1;\nexport const t = {\n  note: "Zapis " + n + " je sa" + "kriven",\n};\n';
    expect(extractUiText("src/lib/i18n/x.ts", source, "catalogue")).toEqual([
      { file: "src/lib/i18n/x.ts", line: 3, text: "Zapis   je sakriven" },
      { file: "src/lib/i18n/x.ts", line: 3, text: "Zapis " },
      { file: "src/lib/i18n/x.ts", line: 3, text: " je sa" },
      { file: "src/lib/i18n/x.ts", line: 3, text: "kriven" },
    ]);
  });

  it("reads the values of a JSON catalogue and not its keys", () => {
    const source = '{\n  "hidden": "Prazno",\n  "list": ["Jedan", { "saved": "Dva" }]\n}\n';
    expect(extractUiText("src/lib/i18n/table.json", source, "catalogue").map((t) => [t.line, t.text])).toEqual([
      [2, "Prazno"],
      [3, "Jedan"],
      [3, "Dva"],
    ]);
  });
});

describe("repository scan of UI text modules", () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });
  const write = (relative: string, content: string): void => {
    const file = path.join(root!, ...relative.split("/"));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  it("reads the listed modules under src and packages and nothing else", () => {
    root = mkdtempSync(path.join(tmpdir(), "ductura-terms-"));
    write("src/lib/i18n/messages.hr.ts", 'export const t = { a: "Sumnjivo kretanje" };\n');
    write("src/lib/i18n/messages.hr.test.ts", 'export const t = { a: "Sumnjivo" };\n');
    write("src/lib/i18n/node_modules/x/messages.ts", 'export const t = { a: "Sumnjivo" };\n');
    write("packages/editor-core/src/sync/labels.ts", 'export const L = { s: "Spremljeno" };\n');
    write("src/components/editor/panel.ts", 'export const t = "Sumnjivo";\n');
    write("tests/messages.ts", 'export const t = "Sumnjivo";\n');
    const { files, findings } = scanUiTextModules(root);
    expect(files).toEqual(["packages/editor-core/src/sync/labels.ts", "src/lib/i18n/messages.hr.ts"]);
    expect(findings.map((f) => [f.file, f.line, f.text, f.terms.map((t) => t.entry)])).toEqual([
      ["packages/editor-core/src/sync/labels.ts", 1, "Spremljeno", ["spremljeno (bez pojašnjenja)"]],
      ["src/lib/i18n/messages.hr.ts", 1, "Sumnjivo kretanje", ["sumnjivo"]],
    ]);
  });

  it("reads the copied Ductus catalogue of this repository", () => {
    const files = findUiTextModules(REPO);
    for (const file of ["src/lib/i18n/messages.hr.ts", "src/lib/i18n/messages.en.ts", "src/lib/i18n/demo-work.hr.ts", "src/lib/i18n/demo-fast-path.hr.ts"]) {
      expect(files, file).toContain(file);
    }
    expect(files.every((file) => isUiTextModule(file))).toBe(true);
  });

  // Every text of the copied front must pass the Ductura dictionary. Fails while the text question on Ductus#2028
  // (c.6995649713, c.6995664632) is open: 19 texts with "copy"/"kopir*" that locales/ has already reworded.
  it("finds no forbidden term in the UI text of this repository", () => {
    const { findings } = scanUiTextModules(REPO);
    expect(findings.map((f) => `${f.file}:${f.line} ${f.terms.map((t) => t.entry).join(", ")}: ${f.text}`)).toEqual([]);
  });
});

describe("findForbiddenTermsInMarkup", () => {
  const inMarkup = (joined: string, spaced: string, closedUp = true) =>
    findForbiddenTermsInMarkup(joined, spaced, closedUp).map((term) => term.entry);
  const HR = "spremljeno (bez pojašnjenja)";
  const EN = "saved (without saying where)";

  it("reports an entry in either reading of markup, a contextual entry only in both", () => {
    expect(inMarkup("Sumnjivo", "Sum njivo")).toEqual(["sumnjivo"]);
    expect(inMarkup("Nestalipodaci", "Nestali podaci")).toEqual(["nestali podaci"]);
    expect(inMarkup("Spremljeno", "Spremljeno")).toEqual([HR]);
    expect(inMarkup("Spremljeno na uređajuPredano", "Spremljeno na uređaju Predano")).toEqual([]);
    expect(inMarkup("Saved on this deviceSubmitted", "Saved on this device Submitted")).toEqual([]);
    expect(inMarkup("Spremljeno lokalno", "Spremljeno  lokalno")).toEqual([HR]);
  });

  it("reports a contextual entry whose word an element split, unless the joined text says where", () => {
    expect(inMarkup("Spremljeno", "S premljeno")).toEqual([HR]);
    expect(inMarkup("Spremljena", "Spremlje na")).toEqual([HR]);
    expect(inMarkup("Saved", "S aved")).toEqual([EN]);
    expect(inMarkup("Spremljeno na uređaju", "S premljeno na uređaju")).toEqual([]);
    expect(inMarkup("Saved on this device", "S aved on this device")).toEqual([]);
    expect(inMarkup("Saved Spremljeno na uređajuPredano", "S aved Spremljeno na uređaju Predano")).toEqual([EN]);
  });

  it("keeps the phrase boundary in both readings", () => {
    expect(inMarkup("Spremljeno. Na uređaju", "Spremljeno.  Na uređaju")).toEqual([HR]);
    expect(inMarkup(`Spremljeno${PHRASE_BREAK}na uređaju`, `Spremljeno${PHRASE_BREAK}na uređaju`)).toEqual([HR]);
    expect(inMarkup("Saved — on the server", "Saved  —  on the server")).toEqual([EN]);
    expect(inMarkup(`Spremljeno na uređaju${PHRASE_BREAK}Predano`, `Spremljeno na uređaju${PHRASE_BREAK}Predano`)).toEqual([]);
  });

  it("reads a word cut by an unknown part closed up, and not with closedUp false", () => {
    const joined = `Sum${PHRASE_BREAK}njivo`;
    expect(inMarkup(joined, joined)).toEqual(["sumnjivo"]);
    expect(inMarkup(joined, joined, false)).toEqual([]);
    // In a window: the parts around the cut word do not hide it.
    const padded = ["Opis", "zapisa", "je", "sum", "njivo", "kraj"].join(PHRASE_BREAK);
    expect(inMarkup(padded, padded)).toEqual(["sumnjivo"]);
  });

  it("closes a cut up past the quotation marks at a boundary", () => {
    expect(closedUpPastQuotes(`„Sum${PHRASE_BREAK}“njivo`)).toBe("„Sumnjivo");
    const joined = `Opis${PHRASE_BREAK}„Sum${PHRASE_BREAK}“njivo${PHRASE_BREAK}kraj`;
    expect(inMarkup(joined, joined)).toContain("sumnjivo");
  });

  it("reads an entry with allows as findForbiddenTerms does (Ductura only)", () => {
    const allowed = "Izjava o izvornosti rada";
    expect(findForbiddenTerms(allowed)).toEqual([]);
    expect(inMarkup(allowed, allowed)).toEqual([]);
    expect(inMarkup("Izvornost rada", "Izvornost rada")).toEqual(findForbiddenTerms("Izvornost rada").map((t) => t.entry));
    expect(inMarkup("Izvornost rada", "Izvornost rada")).toContain("izvornost");
  });

  it("matches findForbiddenTerms on plain text in one piece", () => {
    for (const text of ["Kopirano iz drugog dokumenta", "This text was copied", "Copy citation", "Kopiraj navod", "Spremljeno na uređaju", "Zapis je cjelovit i neizmijenjen od primitka"]) {
      expect(inMarkup(text, text), text).toEqual(findForbiddenTerms(text).map((t) => t.entry));
    }
  });

  it("reports a text whose windows the part bound cuts short", () => {
    const short = ["a", "b", "c"].join(PHRASE_BREAK);
    expect(windowsCutShort(short)).toBe(false);
    const many = Array.from({ length: MAX_WINDOW_PARTS + 2 }, () => ".").join(PHRASE_BREAK);
    expect(windowsCutShort(many)).toBe(true);
  });
});
