import { afterEach, describe, expect, it } from "vitest";

import { CODE_LANGUAGES as SCHEMA_LANGUAGES } from "../../../../../editor-core/src/document/document/schema";
import { CODE_LANGUAGES, highlightRanges, lineCount, rangesFromHtml, setHighlightEngine } from "./highlight.ts";

afterEach(() => setHighlightEngine(null));

describe("highlightRanges", () => {
  it("uses exactly the schema's language list", () => {
    expect([...CODE_LANGUAGES]).toEqual([...SCHEMA_LANGUAGES]);
  });
  it("colours every language of the list, with ranges inside the text and the text unchanged", () => {
    const samples: Record<string, string> = {
      c: "int main(void) { return 0; } // kraj", html: '<p class="a">Tekst</p>', java: "class A { int x = 1; }",
      javascript: "const x = 'a'; function f() { return x; }", python: "def f(x):\n    return 'a' + x  # bilješka",
      r: "x <- c(1, 2, 3)\nmean(x)", sql: "SELECT a FROM t WHERE b = 1;",
    };
    for (const language of CODE_LANGUAGES) {
      const code = samples[language]!;
      const ranges = highlightRanges(code, language);
      expect(ranges, language).not.toBeNull();
      expect(ranges!.length, language).toBeGreaterThan(0);
      for (const r of ranges!) { expect(r.from).toBeGreaterThanOrEqual(0); expect(r.to).toBeLessThanOrEqual(code.length); expect(r.to).toBeGreaterThan(r.from); }
    }
  });
  it("maps a keyword to the right characters", () => {
    const code = "const x = 1;";
    const keyword = highlightRanges(code, "javascript")!.find((r) => r.className === "hljs-keyword")!;
    expect(code.slice(keyword.from, keyword.to)).toBe("const");
  });
  it("refuses a language outside the list, empty code and no language", () => {
    expect(highlightRanges("echo 1", "bash")).toBeNull();
    expect(highlightRanges("echo 1", null)).toBeNull();
    expect(highlightRanges("", "javascript")).toBeNull();
  });
  it("gives null, not a throw, when the library is unavailable", () => {
    setHighlightEngine(() => { throw new Error("nedostupno"); });
    expect(highlightRanges("const x = 1;", "javascript")).toBeNull();
  });
  it("gives null when the library's text does not match the code (no wrong ranges)", () => {
    setHighlightEngine(() => "<span class=\"hljs-keyword\">drugo</span>");
    expect(highlightRanges("const", "javascript")).toBeNull();
  });
  it("decodes entities so offsets stay in the source text", () => {
    const code = "a < b && 'c'";
    const ranges = highlightRanges(code, "javascript")!;
    for (const r of ranges) expect(r.to).toBeLessThanOrEqual(code.length);
    expect(rangesFromHtml("a &lt; <span class=\"x\">b</span>", "a < b")).toEqual([{ from: 4, to: 5, className: "x" }]);
  });
  it("skips input over the size limit", () => {
    expect(highlightRanges("a".repeat(20001), "javascript")).toBeNull();
  });
  it("counts lines", () => {
    expect(lineCount("")).toBe(1);
    expect(lineCount("a\nb\n")).toBe(3);
  });
});
