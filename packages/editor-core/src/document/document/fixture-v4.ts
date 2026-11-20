/**
 * A synthetic document v4 with every block, atom and mark of the contract
 * (docs/contracts/document-schema-v4.md). Invented text only: no real work,
 * person or image. Shared by the tests of the validator, the consumers and the
 * editor interop.
 */

import type { CanonicalDocumentV4, NodeId } from "./schema";

/** A test id: the brand is a type-level fact only. */
export const nid = (value: string): NodeId => value as NodeId;

const id = (n: number): NodeId => nid(`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`);

export const FIXTURE_V4: CanonicalDocumentV4 = {
  schemaVersion: 4,
  sources: [],
  cover: { date: "studeni 2026.", place: "Zagreb", study: "Izmišljeni studij" },
  nodes: [
    { type: "heading", id: id(1), level: 1, children: [{ type: "text", text: "Kućno kompostiranje", marks: [] }] },
    {
      type: "paragraph",
      id: id(2),
      variantGroup: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      children: [
        { type: "text", text: "Prvi ", marks: ["bold"] },
        { type: "text", text: "drugi", marks: ["bold", "italic", { color: "#f2d24b", type: "highlight" }] },
        { type: "text", text: " x", marks: ["sup"] },
        { type: "text", text: "2", marks: ["sub"] },
        { type: "text", text: " compost", marks: [{ lang: "en", type: "lang" }] },
        { type: "text", text: " veza", marks: [{ href: "https://primjer.invalid/", type: "link" }] },
        { type: "text", text: " zalijepljeno", marks: [{ pasteId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", type: "paste" }] },
        { type: "text", text: " uvezeno", marks: ["imported"] },
        { type: "inlineFormula", tex: "x^{2}" },
      ],
    },
    { type: "formula", id: id(3), tex: "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i" },
    {
      type: "codeBlock",
      id: id(4),
      language: "python",
      caption: "Prosjek",
      children: [{ type: "text", text: "def prosjek(xs):\n    return sum(xs) / len(xs)", marks: [] }],
    },
    {
      type: "box",
      id: id(5),
      kind: "theorem",
      children: [{ type: "paragraph", id: id(6), children: [{ type: "text", text: "Svaki konačan skup je ograničen.", marks: [] }] }],
    },
    {
      type: "table",
      id: id(7),
      header: true,
      stripes: true,
      landscape: false,
      headerFill: "#dce6f2",
      cellFills: [{ color: "#fff2cc", column: 1, row: 2 }],
      merges: [{ column: 0, columnSpan: 2, row: 1, rowSpan: 1 }],
      rows: [
        ["Grad", "Kućanstva", "Udio"],
        ["Izmišljeni Grad", "", "12 %"],
        ["Drugi Grad", "340", "9 %"],
      ],
      title: "Kućno kompostiranje po gradovima",
      source: "izrada autora",
    },
    {
      type: "image",
      id: id(8),
      align: "center",
      attachmentId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      attachmentSha256: "0".repeat(64),
      crop: { top: 0, bottom: 0, left: 10, right: 5 },
      landscape: false,
      widthPercent: 60,
      title: "Kompostište u dvorištu",
      source: "izrada autora",
    },
    { type: "pageBreak", id: id(9) },
    { type: "paragraph", id: id(10), children: [] },
  ],
};
