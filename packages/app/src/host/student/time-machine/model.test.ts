import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { timeMachineMessages } from "./messages.hr";
import { FAKE_VERSIONS, fakeTimeMachinePort } from "./fake-port";
import { diffParts, orderedPair, orderVersions, versionText } from "./model";

const FORBIDDEN = /trajanj|ritam|brzin|minuta rada|riječi|razlika od/i;

describe("time machine model", () => {
  it("orders versions newest first and drops duplicate revisions", () => {
    const ordered = orderVersions([...FAKE_VERSIONS, FAKE_VERSIONS[0]!].toReversed());
    expect(ordered.map((v) => v.revision)).toEqual([3, 2, 1]);
  });
  it("puts the older revision first and rejects the same one twice", () => {
    expect(orderedPair(3, 1)).toEqual({ from: 1, to: 3 });
    expect(orderedPair(2, 2)).toBeNull();
  });
  it("builds diff parts with spaces and block breaks", async () => {
    const read = await fakeTimeMachinePort().compare("d", 1, 3);
    if (read.kind !== "ready") throw new Error("ready expected");
    const parts = diffParts([...read.blocks, ...read.blocks]);
    expect(parts.filter((p) => p.kind === "removed").map((p) => p.text)).toEqual(["stari", "stari"]);
    expect(parts.some((p) => p.text === "\n")).toBe(true);
  });
  it("shows no duration, pace or size of change", () => {
    // The check below is only worth anything if it can fail: it catches what PRODUCT §5 forbids.
    for (const bad of ["Trajanje rada", "Ritam pisanja", "Brzina pisanja", "Minuta rada: 12", "Broj riječi", "Razlika od prošle verzije"]) {
      expect(bad).toMatch(FORBIDDEN);
    }
    expect("Verzija 3 · 20. 11. 2026.").not.toMatch(FORBIDDEN);
    const joined = Object.values(timeMachineMessages).map((v) => (typeof v === "string" ? v : (v as (...a: unknown[]) => string)("checkpoint", 1, "2026-11-20T09:15:00.000Z"))).join(" ");
    expect(joined).not.toMatch(FORBIDDEN);
  });
  it("holds no forbidden term (PRODUCT §5)", () => {
    for (const value of Object.values(timeMachineMessages)) if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });

  describe("versionText", () => {
    const text = (value: string) => [{ type: "text", text: value, marks: [] }];
    const read = (document: unknown) => {
      const out = versionText(JSON.stringify(document));
      if (out.kind !== "ready") throw new Error("ready expected");
      return out.blocks.map((b) => (b.kind === "heading" ? `h${b.level}:${b.text}` : b.text));
    };

    it("keeps the words of a footnote and of a citation, in place", () => {
      const doc = { schemaVersion: 3, sources: [{ id: "s1", authors: [{ kind: "person", family: "Izmišljenić", given: "Ana" }], year: 2020, title: "Primjer" }], nodes: [
        { type: "paragraph", id: "a", children: [
          ...text("Tvrdnja"), { type: "footnote", text: "Izmišljena napomena." }, ...text(" i navod"),
          { type: "citation", sourceId: "s1", locator: "str. 4" }, ...text("."),
        ] },
      ] };
      expect(read(doc)).toEqual(["Tvrdnja [fusnota: Izmišljena napomena.] i navod [Izmišljenić 2020, str. 4]."]);
    });

    it("keeps a citation whose source is not listed, without inventing one", () => {
      expect(read({ nodes: [{ type: "paragraph", children: [{ type: "citation", sourceId: "nema" }] }] })).toEqual(["[navod]"]);
    });

    it("keeps the paragraphs of a box and the cells of a table apart", () => {
      const doc = { schemaVersion: 4, nodes: [
        { type: "box", id: "b", kind: "note", children: [
          { type: "paragraph", id: "p1", children: text("Prvi u okviru") }, { type: "paragraph", id: "p2", children: text("Drugi u okviru") },
        ] },
        { type: "table", id: "t", rows: [["A1", "B1"], ["A2", ""]], header: true, stripes: false, landscape: false },
      ] };
      expect(read(doc)).toEqual(["Prvi u okviru", "Drugi u okviru", "A1", "B1", "A2"]);
    });

    it("reads the editor's own json (doc/content) the same way", () => {
      const doc = { doc: { content: [
        { type: "heading", attrs: { level: 2 }, content: text("Uvod") },
        { type: "paragraph", content: [...text("Tekst"), { type: "footnote", attrs: { text: "Napomena." } }] },
        { type: "box", attrs: { kind: "note" }, content: [
          { type: "paragraph", content: text("Prvi") }, { type: "paragraph", content: text("Drugi") },
        ] },
        { type: "table", content: [{ type: "tableRow", content: [
          { type: "tableCell", content: [{ type: "paragraph", content: text("Ćelija 1") }] },
          { type: "tableCell", content: [{ type: "paragraph", content: text("Ćelija 2") }] },
        ] }] },
      ] } };
      expect(read(doc)).toEqual(["h2:Uvod", "Tekst [fusnota: Napomena.]", "Prvi", "Drugi", "Ćelija 1", "Ćelija 2"]);
    });

    it("is unreadable, not partial, for anything that is not a list of nodes", () => {
      for (const bad of ["not json", "[]", "{}", JSON.stringify({ nodes: [1] })]) expect(versionText(bad)).toEqual({ kind: "unreadable" });
    });
  });
});
