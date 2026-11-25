import { describe, expect, it } from "vitest";

import { helpDocumentOf } from "./chapter-help";

const SRC_A = "11111111-1111-4111-8111-111111111111";
const SRC_B = "22222222-2222-4222-8222-222222222222";

const heading = (level: number, text: string, nodeId?: string) => ({ type: "heading", attrs: { level, ...(nodeId ? { nodeId } : {}) }, content: [{ type: "text", text }] });
const para = (...content: object[]) => ({ type: "paragraph", content });
const text = (value: string) => ({ type: "text", text: value });
const cite = (sourceId: string) => ({ type: "citation", attrs: { sourceId } });

const doc = {
  type: "doc",
  attrs: { sources: [
    { id: SRC_A, authors: [{ kind: "person", family: "Horvat" }], year: 2020 },
    { id: SRC_B, authors: [{ kind: "person", family: "Kovač" }], year: 2018 },
  ] },
  content: [
    heading(1, "Izmišljeni naslov rada", "t"),
    para(text("Sažetak pod naslovom nije poglavlje.")),
    heading(2, "Uvod", "a"),
    para(text("Prvi odlomak uvoda "), cite(SRC_A)),
    heading(3, "Pitanje", "a1"),
    para(text("Tekst potpoglavlja "), cite(SRC_B), cite(SRC_A)),
    heading(2, "Rasprava"),
    para(text("Bez navoda.")),
  ],
};

describe("helpDocumentOf (ED-36)", () => {
  it("reads chapters at heading 2 and subchapters at heading 3, keyed like the table of contents", () => {
    const { chapters } = helpDocumentOf(doc);
    expect(chapters.map((c) => [c.id, c.number, c.title, c.parentId])).toEqual([
      ["a", "1", "Uvod", null],
      ["a1", "1.1", "Pitanje", "a"],
      // A heading without its block id yet is keyed by its place among all headings.
      ["heading-3", "2", "Rasprava", null],
    ]);
  });

  it("leaves the title of the work and the text under it out of every chapter", () => {
    const { chapters } = helpDocumentOf(doc);
    expect(chapters.some((c) => c.text.includes("Sažetak"))).toBe(false);
    expect(chapters[0]!.words).toBe(3);
    expect(chapters[0]!.cites).toBe(1);
  });

  it("lists the sources a chapter cites with its subchapters, each once, in text order", () => {
    const { sourceLabels } = helpDocumentOf(doc);
    expect(sourceLabels.a).toEqual(["Horvat (2020)", "Kovač (2018)"]);
    expect(sourceLabels["heading-3"]).toBeUndefined();
  });

  it("has no chapters for an empty or missing document", () => {
    expect(helpDocumentOf(null).chapters).toEqual([]);
    expect(helpDocumentOf({ type: "doc", content: [] }).sourceLabels).toEqual({});
  });
});
