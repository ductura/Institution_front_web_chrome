import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { pregledHr } from "./messages.hr";
import { reviewDocOf } from "../../../../../../src/components/editor/review/model";
import {
  abbreviations, addTerm, chapterAt, frequentWords, listenText, loadTerms, MAX_TERMS, nextTermPlace, outlineFlags, outlineRows, removeTerm, saveTerms, scopeRange, termCount, WHOLE,
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
    expect(rows[1]!.words).toBe(36);
    expect(outlineRows(doc, { kind: "chapter", index: 1 })).toHaveLength(2);
  });
  it("ED-72: counts the paragraph's words and citations and cuts a sentence past 200 characters", () => {
    const rows = outlineRows(doc, WHOLE);
    expect(rows.map((r) => r.paragraphWords)).toEqual([6, 37, 10, 2]);
    expect(rows.map((r) => r.citations)).toEqual([0, 0, 0, 0]);
    const words = Array.from({ length: 50 }, (_, i) => `rijec${i}`).join(" ");
    const cut = outlineRows(reviewDocOf([{ kind: "paragraph", text: `${words}.`, citations: 2 }]), WHOLE)[0]!;
    expect(cut.sentence.length).toBeGreaterThan(200);
    expect(cut.shown).toHaveLength(198);
    expect(cut.shown.endsWith("…")).toBe(true);
    expect(cut.shown.slice(0, 197)).toBe(cut.sentence.slice(0, 197));
    expect(cut.citations).toBe(2);
    expect(rows[0]!.shown).toBe(rows[0]!.sentence);
  });
  it("ED-72: flags a paragraph without citations, of one sentence, or too long", () => {
    expect(outlineFlags(61, 0, 3)).toEqual(["noCitations"]);
    expect(outlineFlags(60, 0, 3)).toEqual([]);
    expect(outlineFlags(61, 1, 3)).toEqual([]);
    expect(outlineFlags(13, 1, 1)).toEqual(["oneSentence"]);
    expect(outlineFlags(12, 1, 1)).toEqual([]);
    expect(outlineFlags(251, 0, 1)).toEqual(["noCitations", "oneSentence", "longParagraph"]);
    expect(outlineFlags(250, 4, 9)).toEqual([]);
    const one = Array.from({ length: 20 }, () => "riječ").join(" ");
    expect(outlineRows(reviewDocOf([{ kind: "paragraph", text: `${one}.`, citations: 1 }]), WHOLE)[0]!.flags).toEqual(["oneSentence"]);
  });
  it("ED-72: speaks the prototype's words, without a middle dot", () => {
    expect(pregledHr.nacrtIntro).toBe("Prva rečenica svakog odlomka. Ako se ovako čita kao argument, odlomci su dobro složeni.");
    expect(pregledHr.nacrtEmpty).toBe("Ovdje još nema odlomaka.");
    expect([1, 2, 5, 11, 21].map(pregledHr.citations)).toEqual(["1 navod", "2 navoda", "5 navoda", "11 navoda", "21 navod"]);
    expect(pregledHr.words(1)).toBe("1 riječ");
    expect(pregledHr.longFirstTag(41)).toBe("41 riječi");
    expect(pregledHr.longFirst(41)).toBe("Prva rečenica ima 41 riječi; glavna misao se gubi.");
    expect(Object.values(pregledHr.flags)).toEqual(["bez navoda", "jedna rečenica", "dug odlomak"]);
    const source = readFileSync(join(__dirname, "PregledGroup.tsx"), "utf8");
    const nacrt = source.slice(source.indexOf("function Nacrt("), source.indexOf("function Pojmovnik("));
    expect(nacrt).toContain("row.shown");
    expect(nacrt).toContain("t.citations(row.citations)");
    expect(nacrt).toContain("t.flags[flag]");
    expect(nacrt).not.toContain("·");
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
  it("ED-124: goes to the next paragraph that uses a term, round again, only in scope", () => {
    const places = doc.blocks.filter((b) => b.kind !== "heading").map((b) => b.pos);
    expect(nextTermPlace(doc, WHOLE, "rečenica", -1)).toBe(places[0]);
    expect(nextTermPlace(doc, WHOLE, "upitnik", places[0]!)).toBe(places[2]);
    expect(nextTermPlace(doc, WHOLE, "upitnik", places[2]!)).toBe(places[2]);
    expect(nextTermPlace(doc, WHOLE, "EU", places[3]!)).toBe(places[2]);
    expect(nextTermPlace(doc, { kind: "chapter", index: 2 }, "upitnik", 0)).toBeNull();
    expect(nextTermPlace(doc, WHOLE, "Metoda", 0)).toBeNull(); // headings are not uses
    expect(pregledHr.termWhere).toBe("Gdje se koristi");
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
