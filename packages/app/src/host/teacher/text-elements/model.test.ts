import { describe, expect, it } from "vitest";
import { buildElements, citationLabel } from "./model";

const SRC = { id: "11111111-1111-4111-8111-111111111111", type: "book", authors: [{ kind: "person", family: "Autor A", given: "Ana" }], year: 2019, title: "Izmišljena knjiga", place: "Grad", publisher: "Nakladnik" } as const;
const doc = (children: unknown[]) => ({ schemaVersion: 3, sources: [SRC], nodes: [{ type: "paragraph", id: "22222222-2222-4222-8222-222222222222", children }] }) as never;

describe("text elements", () => {
  it("shows a citation with its locator", () => {
    expect(citationLabel(SRC as never, "14")).toBe("(Autor A, 2019: 14)");
    const e = buildElements(doc([{ type: "text", text: "Tvrdnja ", marks: [] }, { type: "citation", sourceId: SRC.id, locator: "14" }]));
    expect(e.blocks[0]!.pieces[1]).toEqual({ kind: "cite", label: "(Autor A, 2019: 14)" });
    expect(e.hasElements).toBe(true);
  });
  it("shows a citation without a known source as an open place", () => {
    const e = buildElements(doc([{ type: "citation", sourceId: "33333333-3333-4333-8333-333333333333" }]));
    expect(e.blocks[0]!.pieces[0]).toEqual({ kind: "open" });
  });
  it("numbers footnotes in order of appearance", () => {
    const e = buildElements(doc([{ type: "footnote", text: "Prva." }, { type: "text", text: "x", marks: [] }, { type: "footnote", text: "Druga." }]));
    expect(e.notes).toEqual([{ number: 1, text: "Prva." }, { number: 2, text: "Druga." }]);
  });
  it("plain v1 text has no elements", () => {
    const e = buildElements({ schemaVersion: 1, nodes: [{ type: "paragraph", id: "22222222-2222-4222-8222-222222222222", children: [{ type: "text", text: "a", marks: [] }] }] } as never);
    expect(e.hasElements).toBe(false);
    expect(e.notes).toEqual([]);
  });
});
