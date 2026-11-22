import { describe, expect, it } from "vitest";

import { reviewDocOf } from "../../../../../../src/components/editor/review/model";
import {
  abbreviations, addTerm, chapterAt, frequentWords, listenText, loadTerms, MAX_TERMS, outlineRows, removeTerm, saveTerms, scopeRange, termCount, WHOLE,
} from "./pregled-model";

// WEB-2127: invented text only.
const long = Array.from({ length: 36 }, () => "da").join(" ");
const doc = reviewDocOf([
  { kind: "heading", level: 1, text: "Uvod", id: "h1" },
  { kind: "paragraph", text: "Prva rečenica uvoda. Druga rečenica uvoda." },
  { kind: "heading", level: 1, text: "Metoda", id: "h2" },
  { kind: "paragraph", text: `${long}. Kratka.` },
  { kind: "paragraph", text: "Upitnik ispitanici upitnik. Upitnik i EU te NN i XIV." },
  { kind: "heading", level: 1, text: "Zaključak", id: "h3" },
  { kind: "paragraph", text: "Završetak rada." },
]);

describe("pregled scope", () => {
  it("finds the chapter of a position and the block range of a chapter", () => {
    expect(chapterAt(doc, 0)).toBe(0);
    expect(chapterAt(doc, 3)).toBe(1);
    expect(scopeRange(doc, { kind: "chapter", index: 1 })).toEqual({ first: 2, end: 5 });
    expect(scopeRange(doc, WHOLE)).toEqual({ first: 0, end: 7 });
    expect(scopeRange(doc, { kind: "chapter", index: 99 })).toEqual({ first: 0, end: 7 });
  });
});

describe("Nacrt", () => {
  it("lists the first sentence of each paragraph and flags a long one", () => {
    const rows = outlineRows(doc, WHOLE);
    expect(rows.map((r) => r.sentence.slice(0, 12))).toEqual(["Prva rečenic", "da da da da ", "Upitnik ispi", "Završetak ra"]);
    expect(rows.map((r) => r.long)).toEqual([false, true, false, false]);
    expect(rows[0]!.chapter).toBe("1. Uvod");
    expect(outlineRows(doc, { kind: "chapter", index: 1 })).toHaveLength(2);
  });
  it("reads what is in scope, paragraph per line", () => {
    expect(listenText(doc, { kind: "chapter", index: 0 })).toBe("Uvod\nPrva rečenica uvoda. Druga rečenica uvoda.");
    expect(listenText(reviewDocOf([]), WHOLE)).toBe("");
  });
});

describe("Pojmovnik", () => {
  it("counts a term as a whole word and abbreviations as written", () => {
    expect(termCount("Upitnik, upitnika i UPITNIK.", "upitnik")).toBe(2);
    expect(termCount("EU i eu", "EU")).toBe(1);
    expect(termCount("tekst", " ")).toBe(0);
  });
  it("lists frequent words and abbreviations in scope, no roman numerals", () => {
    expect(frequentWords(doc, WHOLE)).toEqual([{ word: "upitnik", count: 3 }]);
    expect(abbreviations(doc, WHOLE).map((a) => a.abbreviation)).toEqual(["EU", "NN"]);
  });
  it("adds, rejects duplicates and empties, caps and removes", () => {
    const a = addTerm([], "  EU ", " Europska unija ");
    expect(a).toEqual({ ok: true, terms: [{ term: "EU", definition: "Europska unija" }] });
    if (!a.ok) throw new Error();
    expect(addTerm(a.terms, "eu", "")).toEqual({ ok: false, reason: "duplicate" });
    expect(addTerm(a.terms, "  ", "x")).toEqual({ ok: false, reason: "empty" });
    expect(addTerm(Array.from({ length: MAX_TERMS }, (_, i) => ({ term: `t${i}`, definition: "" })), "novi", "")).toEqual({ ok: false, reason: "full" });
    expect(removeTerm(a.terms, "EU")).toEqual([]);
  });
  it("keeps terms per work and survives broken or missing storage", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(saveTerms(storage, "w1", [{ term: "EU", definition: "x" }])).toBe(true);
    expect(loadTerms(storage, "w1")).toEqual([{ term: "EU", definition: "x" }]);
    expect(loadTerms(storage, "w2")).toEqual([]);
    data.set("ductura.editor.glossary:w3", "{oops");
    expect(loadTerms(storage, "w3")).toEqual([]);
    expect(saveTerms(null, "w1", [])).toBe(false);
    expect(saveTerms({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, "w1", [])).toBe(false);
    expect(loadTerms(null, "w1")).toEqual([]);
  });
});
