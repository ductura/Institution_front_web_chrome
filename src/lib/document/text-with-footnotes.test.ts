import { describe, expect, it } from "vitest";
import { textWithFootnotes, type TextSource } from "./text-with-footnotes";

/** Fake sheet: paragraphs of text parts and footnote atoms, serialised like Tiptap getText. */
function sheet(paragraphs: Array<Array<string | { footnote: string }>>): TextSource {
  return {
    getText(options) {
      return paragraphs.map((parts) => parts.map((part) => {
        if (typeof part === "string") return part;
        const serialise = options?.textSerializers?.footnote;
        return serialise ? serialise({ node: { attrs: { text: part.footnote } } }) : "";
      }).join("")).join("\n\n");
    },
  };
}

describe("textWithFootnotes", () => {
  it("returns byte-identical getText for a v1 sheet without footnotes", () => {
    const s = sheet([["Uvod u izmišljeni rad."], ["Drugi odlomak."]]);
    expect(textWithFootnotes(s)).toBe(s.getText());
  });

  it("marks footnotes [n] in order and lists them at the end", () => {
    const s = sheet([["Uvod", { footnote: "Izmišljena bilješka A." }], ["Kraj", { footnote: "Izmišljena bilješka B." }]]);
    expect(textWithFootnotes(s)).toBe("Uvod[1]\n\nKraj[2]\n\n[1] Izmišljena bilješka A.\n[2] Izmišljena bilješka B.");
  });

  it("numbers fresh on every call", () => {
    const s = sheet([["x", { footnote: "a" }]]);
    expect(textWithFootnotes(s)).toBe(textWithFootnotes(s));
  });
});
