import { describe, expect, it } from "vitest";

import { CITATION_MARK, reviewDocOf } from "../../../../../../src/components/editor/review/model";
import { pregledHr as t } from "./messages.hr";
import { blockTextAt, LONG_SENTENCE_WORDS, sentenceShape } from "./sentence-shape";

// ED-73: invented text only.
const words = (n: number) => ["Riječ", ...Array.from({ length: n - 1 }, () => "riječ")].join(" ");

describe("Oblik rečenica", () => {
  it("draws one bar per sentence, as wide as its share of the longest", () => {
    const bars = sentenceShape(`${words(20)}. ${words(5)}. ${words(10)}!`);
    expect(bars.map((b) => b.words)).toEqual([20, 5, 10]);
    expect(bars.map((b) => b.width)).toEqual([100, 25, 50]);
    expect(bars.every((b) => !b.long)).toBe(true);
  });

  it("marks a sentence longer than 40 words, not one of exactly 40", () => {
    const bars = sentenceShape(`${words(LONG_SENTENCE_WORDS)}. ${words(LONG_SENTENCE_WORDS + 1)}.`);
    expect(bars.map((b) => b.long)).toEqual([false, true]);
    expect(bars[0]!.width).toBe(98);
  });

  it("does not count a citation as a word and gives nothing for an empty paragraph", () => {
    expect(sentenceShape(`Kratka tvrdnja ${CITATION_MARK}. Druga.`).map((b) => b.words)).toEqual([2, 1]);
    expect(sentenceShape("")).toEqual([]);
    expect(sentenceShape("   ")).toEqual([]);
  });

  it("reads the paragraph at the cursor", () => {
    const doc = reviewDocOf([
      { kind: "heading", level: 1, text: "Uvod", id: "h1" },
      { kind: "paragraph", text: "Prva. Druga rečenica." },
      { kind: "paragraph", text: "Treći odlomak." },
    ]);
    expect(blockTextAt(doc, 1)).toBe("Prva. Druga rečenica.");
    expect(blockTextAt(doc, 2)).toBe("Treći odlomak.");
    expect(blockTextAt(doc, -1)).toBeNull();
  });

  it("uses the prototype's words, without a middle dot", () => {
    expect(t.oblik).toBe("Oblik rečenica");
    expect(t.shapeEmpty).toBe("U odlomku nema rečenica.");
    expect(t.shapeHint).toBe("Izmjena kratkih i dugih rečenica čini tekst čitljivijim.");
    expect(t.shapeBar(3, 41, true)).not.toContain("·");
  });
});
