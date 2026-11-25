import { describe, expect, it } from "vitest";

import { checkFormat, wordsOf, type FormatRules } from "./format-check";
import { linesOf, summaryOf } from "./panel-model";
import type { TextNode } from "../../student/submission/work-read";

const p = (text: string): TextNode => ({ type: "paragraph", children: [{ text, marks: [] }] });
const h = (text: string): TextNode => ({ type: "heading", level: 1, children: [{ text, marks: [] }] });
const RULES: FormatRules = { wordMin: 5, wordMax: 12, minSources: 2, requiredSections: ["Uvod", "Zaključak"], citationStyle: "fpzg", font: null, size: null, spacing: null };
const status = (nodes: TextNode[], rules: Partial<FormatRules> = {}) =>
  Object.fromEntries(checkFormat(nodes, { ...RULES, ...rules }).items.map((i) => [i.id, i.status]));

const GOOD = [h("1. Uvod"), p("Izmišljeni kompost raste (Horvat, 2019: 4) svaki dan."), h("Zaključak"), h("Literatura"), p("Horvat, A. (2019) Kompost."), p("Kovač, B. (2020) Vrt.")];

describe("checkFormat", () => {
  it("passes a text that follows every rule, leaving the literature out of the word count", () => {
    const result = checkFormat(GOOD, RULES);
    expect(result.deviations).toBe(0);
    expect(status(GOOD)).toMatchObject({ words: "ok", sources: "ok", sections: "ok", citations: "ok", font: "unavailable", size: "unavailable", spacing: "unavailable" });
    expect(result.items[0]?.values.n).toBe(8);
  });
  it("names each deviation and nothing else", () => {
    const bad = [h("Uvod"), p("Premalo (Horvat 2019)."), h("Literatura"), p("Jedan izvor.")];
    expect(status(bad)).toMatchObject({ words: "deviation", sources: "deviation", sections: "deviation", citations: "deviation" });
    expect(checkFormat(bad, RULES).items.find((i) => i.id === "sections")?.values.names).toBe("Zaključak");
    expect(checkFormat([...GOOD, p("x ".repeat(20))].slice(0, 2).concat(GOOD.slice(2)), RULES).deviations).toBeLessThanOrEqual(1);
    expect(status([h("Uvod"), p("riječ ".repeat(13))], { requiredSections: [], minSources: 0 })).toMatchObject({ words: "deviation", sources: "none", sections: "none" });
  });
  it("leaves unset rules out and flags a numeric citation as outside the FPZG form", () => {
    expect(status(GOOD, { wordMin: null, wordMax: null, minSources: 0, requiredSections: [] })).toMatchObject({ words: "none", sources: "none", sections: "none" });
    expect(status([p("Tvrdnja [1] bez imena.")], {})).toMatchObject({ citations: "deviation" });
    expect(status([p("Tvrdnja [izvor] čeka izvor.")], {})).toMatchObject({ citations: "ok" });
  });
  it("accepts FPZG forms with several authors and a suffix, and an empty text deviates instead of passing", () => {
    expect(status([p("A (Becker, Strauss, 2007a: 9) i (Horvat, 2019).")])).toMatchObject({ citations: "ok" });
    expect(status([])).toMatchObject({ words: "deviation", sections: "deviation", sources: "deviation" });
  });
  it("counts words, not punctuation", () => { expect(wordsOf("Jedan, dva — tri.")).toBe(3); });
  it("names a font rule from Lekta without judging the text, and says so in words", () => {
    const result = checkFormat(GOOD, { ...RULES, font: "Times New Roman", size: 12, spacing: 1.5 });
    expect(result.items.filter((i) => i.status === "rule").map((i) => i.values.value)).toEqual(["Times New Roman", "12 pt", "1.5"]);
    expect(linesOf(result).find((l) => l.id === "font")?.detail).toContain("Times New Roman");
    expect(summaryOf(result)).toBe("Nema odstupanja od pravila oblika.");
  });
});
