import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// The forbidden terms of Ductus docs/PRODUCT.md §5, as the application's scan
// holds them. That scan reads only locales/, so the interface text this package
// writes itself (sync chip labels, server sync messages) is checked here. It is
// loaded by URL so the package's type check does not follow into scripts/.
type Term = { lang: string; pattern: RegExp };
const dictionary = (await import(
  new URL("../../../../scripts/forbidden-terms/terms.ts", import.meta.url).href
)) as { findForbiddenTerms: (text: string) => Term[] };

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Every string a module writes, outside imports and types. */
function strings(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) return;
    if (ts.isTypeNode(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith(".ts") && !/\.(?:test|spec)\.ts$/.test(entry.name) ? [full] : [];
  });
}

describe("interface text in src/sync", () => {
  it("reads the modules that hold interface text", () => {
    const read = sources(HERE).map((file) => path.relative(HERE, file).split(path.sep).join("/"));
    expect(read).toEqual(expect.arrayContaining(["labels.ts", "server/messages.ts"]));
    expect(strings(path.join(HERE, "labels.ts"))).toContain("Spremljeno na uređaju");
  });

  it("holds no forbidden term in any string", () => {
    const found = sources(HERE).flatMap((file) =>
      strings(file)
        .filter((text) => dictionary.findForbiddenTerms(text).length > 0)
        .map((text) => `${path.relative(HERE, file)}: ${JSON.stringify(text)}`),
    );
    expect(found).toEqual([]);
  });

  it("finds a forbidden term when one is written", () => {
    expect(dictionary.findForbiddenTerms("Rizik plagijata").length).toBeGreaterThan(0);
  });
});
