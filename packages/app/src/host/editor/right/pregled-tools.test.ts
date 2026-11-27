import { describe, expect, it } from "vitest";

import { CITATION_MARK, reviewDocOf } from "../../../../../../src/components/editor/review/model";
import { WHOLE } from "./pregled-model";
import { consistency, nextUse, numbersWithoutSource, quotations, repeatedWords, seams, sentenceStarts } from "./pregled-tools";
import { pregledHr as t, plural, thousands } from "./messages.hr";

// ED-74: invented text only.
const doc = reviewDocOf([
  { kind: "heading", level: 1, text: "Uvod", id: "h1" },
  { kind: "paragraph", text: "Prva rečenica uvoda. Uvod završava ovdje." },
  { kind: "heading", level: 1, text: "Metoda", id: "h2" },
  { kind: "heading", level: 2, text: "Uzorak", id: "h21" },
  { kind: "paragraph", text: "Metoda počinje ovako. Druga rečenica." },
  { kind: "paragraph", text: "Kraj metode." },
  { kind: "heading", level: 1, text: "Zaključak", id: "h3" },
]);

describe("Šavovi", () => {
  it("pairs the end of each top chapter with the start of the next", () => {
    const list = seams(doc, WHOLE);
    expect(list).toHaveLength(2);
    expect(list[0]!.end).toEqual({ chapter: "1. Uvod", sentence: "Uvod završava ovdje.", pos: 1 });
    expect(list[0]!.start).toEqual({ chapter: "2. Metoda", sentence: "Metoda počinje ovako.", pos: 4 });
    expect(list[1]!.end.sentence).toBe("Kraj metode.");
    expect(list[1]!.start).toEqual({ chapter: "3. Zaključak", sentence: null, pos: null });
  });
  it("keeps only the seams of the chapter in scope, a subchapter counting as its top chapter", () => {
    expect(seams(doc, { kind: "chapter", index: 0 }).map((s) => s.key)).toEqual(["0-1"]);
    expect(seams(doc, { kind: "chapter", index: 2 }).map((s) => s.key)).toEqual(["0-1", "1-3"]);
    expect(seams(reviewDocOf([{ kind: "heading", level: 1, text: "Jedino" }]), WHOLE)).toEqual([]);
  });
});

describe("Ponavljanja", () => {
  const rep = reviewDocOf([
    { kind: "paragraph", text: "Također je važno. Također se vidi. Također valja reći. Ovo nije. Ovo jest." },
    { kind: "paragraph", text: Array.from({ length: 6 }, () => "ispitanici").join(" ") + " ispitanik također također također također također također" },
  ]);
  it("lists sentence starts used three times or more", () => {
    expect(sentenceStarts(rep, WHOLE)).toEqual([{ word: "Također", count: 3, pos: 0 }]);
  });
  it("counts words by their first six letters and leaves stop words out", () => {
    expect(repeatedWords(rep, WHOLE)).toEqual([{ word: "ispitanici", key: "ispita", count: 7 }]);
  });
  it("finds the next use after the cursor, else the first", () => {
    expect(nextUse(rep, "ispita", 0)).toBe(1);
    expect(nextUse(rep, "ispita", 1)).toBe(1);
    expect(nextUse(rep, "nema", 0)).toBeNull();
  });
});

describe("Dosljednost", () => {
  it("reports a category written in more than one way, with its forms by count", () => {
    const d = reviewDocOf([
      { kind: "paragraph", text: "Udio je 5 % u 2010. i 7% kasnije, a 9 % na kraju." },
      { kind: "paragraph", text: "Razdoblje 1941–1947 i grad od 10 000 stanovnika." },
    ]);
    const r = consistency(d, WHOLE);
    expect(r.mixed).toEqual([{ name: "Postotak", forms: [{ form: "5 %", count: 2, pos: 0 }, { form: "5%", count: 1, pos: 0 }] }]);
    expect(r.consistent).toEqual(["razdoblja", "tisućice", "desetljeća", "navodnici"]);
    expect(t.dosOk(r.consistent)).toBe("Dosljedno: razdoblja, tisućice, desetljeća, navodnici.");
  });
  it("tells straight from Croatian quotation marks", () => {
    const d = reviewDocOf([{ kind: "paragraph", text: "Autor kaže „da” i \"ne\"." }]);
    expect(consistency(d, WHOLE).mixed[0]!.forms.map((f) => f.form)).toEqual(['" "', "„ ”"]);
  });
});

describe("Brojke bez izvora", () => {
  it("reuses the num check and keeps the scope", () => {
    const d = reviewDocOf([
      { kind: "heading", level: 1, text: "Jedan" },
      { kind: "paragraph", text: "Nezaposlenost je pala na 12 %. Druga je tvrdnja (Horvat, 2020)." },
      { kind: "heading", level: 1, text: "Dva" },
      { kind: "paragraph", text: `Grad ima 5 000 stanovnika ${CITATION_MARK}.` },
      { kind: "paragraph", text: "Uzorak je imao 40 ispitanika." },
    ]);
    expect(numbersWithoutSource(d, WHOLE).map((r) => r.number)).toEqual(["12 %", "40 ispitanik"]);
    expect(numbersWithoutSource(d, { kind: "chapter", index: 0 }).map((r) => r.pos)).toEqual([1]);
  });
});

describe("Doslovni navodi", () => {
  it("counts quoted words against the words in scope and flags long inline quotes", () => {
    const longQuote = Array.from({ length: 41 }, () => "riječ").join(" ");
    const d = reviewDocOf([
      { kind: "paragraph", text: `Autor piše „kratak navod ovdje” i dalje „${longQuote}”.` },
      { kind: "quote", text: "Navod u zasebnom bloku od nekoliko riječi." },
      { kind: "paragraph", text: "Bez navoda." },
    ]);
    const q = quotations(d, WHOLE);
    expect(q.list.map((x) => [x.words, x.block])).toEqual([[41, false], [7, true], [3, false]]);
    expect(q.long.map((x) => x.words)).toEqual([41]);
    expect(q.quoted).toBe(51);
    expect(q.total).toBe(7 + 41 + 7 + 2);
    expect(t.quoWords(7, true)).toBe("7 riječi (zaseban blok)");
    expect(quotations(reviewDocOf([]), WHOLE).list).toEqual([]);
  });
});

describe("texts", () => {
  it("uses Croatian plurals and spaces in thousands", () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, "a", "b", "c")).join("")).toBe("abccabc");
    expect(t.repStartCount(3)).toBe("3 rečenice počinju ovako");
    expect(t.dosWays(2)).toBe("zapisano na 2 načina");
    expect(thousands(12345)).toBe("12 345");
    const texts: unknown[] = Object.values(t);
    expect(texts.some((v) => typeof v === "string" && v.includes("·"))).toBe(false);
  });
});
