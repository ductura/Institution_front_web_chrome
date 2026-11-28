import { describe, expect, it } from "vitest";

import { citationStyleOf } from "../../citation-styles/catalog";
import { citationStyleText } from "../../citation-styles/messages.hr";
import { deriveBibliography, formatCitation } from "../../../../../../editor-core/src/document/citation/index.ts";
import type { CanonicalDocumentV3, CitationNode, DocumentSource } from "../../../../../../editor-core/src/document/document/schema";
import { citationToCopy, effectiveStyle, styledLiterature, toSource } from "./styled-entries";

// Synthetic data only: invented authors, titles and publishers.
const book = (family: string, title: string, year = 2020, extra: Record<string, unknown> = {}) =>
  ({ id: `s-${title}`, type: "book", authors: [{ kind: "person", family, given: "Ana" }], year, title, place: "Zagreb", publisher: "Izmišljena naklada", ...extra });
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[] };
const cite = (sourceId: string, locator?: string): Node => ({ type: "citation", attrs: locator === undefined ? { sourceId } : { sourceId, locator } });
const docOf = (sources: unknown[], ...citations: Node[]): Node =>
  ({ type: "doc", attrs: { sources }, content: [{ type: "paragraph", content: citations }] });

// Cited order: Prvi, Treći, Drugi, Prvi. Alphabet (Anić, Anić, Babić) differs from that order.
const sources = [book("Babić", "Prvi"), book("Anić", "Drugi"), book("Anić", "Treći")];
const doc = docOf(sources, cite("s-Prvi", "12-14"), cite("s-Treći"), cite("s-Drugi"), cite("s-Prvi"), cite("s-nema"));
const style = (id: Parameters<typeof citationStyleOf>[0]) => citationStyleOf(id)!;

describe("styledLiterature", () => {
  it("fpzg: author-date entries in alphabetical order with year suffixes, in-text in text order", () => {
    const out = styledLiterature(doc, style("fpzg"));
    expect(out.entries.map((e) => e.text)).toEqual([
      "Anić, Ana (2020a) Drugi. Zagreb: Izmišljena naklada.",
      "Anić, Ana (2020b) Treći. Zagreb: Izmišljena naklada.",
      "Babić, Ana (2020) Prvi. Zagreb: Izmišljena naklada.",
    ]);
    expect(out.entries.every((e) => e.number === undefined)).toBe(true);
    expect(out.citations.map((c) => c.text)).toEqual(["(Babić, 2020: 12–14)", "(Anić, 2020b)", "(Anić, 2020a)", "(Babić, 2020)"]);
    expect(out.orphanCitations).toBe(1);
    expect(out.unformatted).toEqual([]);
  });

  it("ieee: [1], [2] by first citation and the list in order of citing", () => {
    const out = styledLiterature(doc, style("ieee"));
    expect(out.entries.map((e) => [e.number, e.sourceId])).toEqual([[1, "s-Prvi"], [2, "s-Treći"], [3, "s-Drugi"]]);
    expect(out.entries.map((e) => e.text)).toEqual([
      "[1] Babić, Ana (2020) Prvi. Zagreb: Izmišljena naklada.",
      "[2] Anić, Ana (2020) Treći. Zagreb: Izmišljena naklada.",
      "[3] Anić, Ana (2020) Drugi. Zagreb: Izmišljena naklada.",
    ]);
    expect(out.citations.map((c) => c.text)).toEqual(["[1, str. 12–14]", "[2]", "[3]", "[1]"]);
  });

  it("vancouver numbers the same way with its own marks", () => {
    const out = styledLiterature(doc, style("vancouver"));
    expect(out.entries.map((e) => e.text.slice(0, 3))).toEqual(["1. ", "2. ", "3. "]);
    expect(out.citations.map((c) => c.text)).toEqual(["(1, str. 12–14)", "(2)", "(3)", "(1)"]);
  });

  it("numeric result equals deriveBibliography and formatCitation of editor-core", () => {
    const v3 = {
      schemaVersion: 3,
      sources: sources as unknown as DocumentSource[],
      nodes: [{ type: "paragraph", id: "n", children: [
        { type: "citation", sourceId: "s-Prvi", locator: "12-14" }, { type: "citation", sourceId: "s-Treći" },
        { type: "citation", sourceId: "s-Drugi" }, { type: "citation", sourceId: "s-Prvi" },
      ] }],
    } as unknown as CanonicalDocumentV3;
    for (const id of ["ieee", "vancouver"] as const) {
      const bibliography = deriveBibliography(v3, style(id));
      const out = styledLiterature(docOf(sources, cite("s-Prvi", "12-14"), cite("s-Treći"), cite("s-Drugi"), cite("s-Prvi")), style(id));
      expect(out.entries.map((e) => e.text)).toEqual(bibliography.entries.map((e) => e.text));
      const nodes = (v3.nodes[0] as unknown as { children: CitationNode[] }).children;
      expect(out.citations.map((c) => c.text)).toEqual(nodes.map((n) => formatCitation(n, bibliography, style(id))));
    }
  });

  it("the style changes the text, not which sources are listed", () => {
    const ids = (id: "fpzg" | "ieee") => styledLiterature(doc, style(id)).entries.map((e) => e.sourceId).sort();
    expect(ids("ieee")).toEqual(ids("fpzg"));
  });

  it("lists only cited sources and never changes the input", () => {
    const withUnused = docOf([...sources, book("Kovač", "Nenavedeni")], cite("s-Prvi"));
    const before = JSON.stringify(withUnused);
    const out = styledLiterature(withUnused, style("fpzg"));
    expect(out.entries.map((e) => e.sourceId)).toEqual(["s-Prvi"]);
    expect(JSON.stringify(withUnused)).toBe(before);
  });

  it("a source the style cannot format gets no entry and no number; the others are not renumbered wrongly", () => {
    const broken = { id: "s-Pokvaren", type: "book", authors: [{ kind: "person", family: "Horvat", given: "Ivo" }], year: 2019, title: "Pokvaren" };
    const withBroken = docOf([broken, book("Babić", "Prvi")], cite("s-Pokvaren"), cite("s-Prvi"));
    for (const id of ["fpzg", "ieee"] as const) {
      const out = styledLiterature(withBroken, style(id));
      expect(out.unformatted).toEqual(["s-Pokvaren"]);
      expect(out.entries.map((e) => e.sourceId)).toEqual(["s-Prvi"]);
      expect(out.citations.map((c) => c.sourceId)).toEqual(["s-Prvi"]);
      if (id === "ieee") expect(out.entries[0]!.number).toBe(1);
    }
  });

  it("handles no document, no sources and malformed nodes", () => {
    for (const bad of [null, undefined, {}, { type: "doc", attrs: { sources: "x" } }, docOf([null, 5, { id: 3 }], { type: "citation", attrs: { sourceId: 7 } })]) {
      expect(styledLiterature(bad as never, style("fpzg"))).toEqual({ entries: [], citations: [], unformatted: [], orphanCitations: 0 });
    }
  });

  it("finds citations nested inside other inline nodes", () => {
    const nested: Node = { type: "doc", attrs: { sources }, content: [{ type: "paragraph", content: [{ type: "text" }, { type: "emphasis", content: [cite("s-Prvi")] }] }] };
    expect(styledLiterature(nested, style("fpzg")).citations.map((c) => c.text)).toEqual(["(Babić, 2020)"]);
  });
});

describe("citationToCopy (ED-106 Kopiraj navod)", () => {
  it("author-date: the citation without a page, with the year letter of the list", () => {
    expect(citationToCopy(doc, style("fpzg"), "s-Prvi")).toBe("(Babić, 2020)");
    expect(citationToCopy(doc, style("fpzg"), "s-Treći")).toBe("(Anić, 2020b)");
  });

  it("a source not yet cited can still be copied", () => {
    const withUnused = docOf([...sources, book("Kovač", "Nenavedeni", 2018)], cite("s-Prvi"));
    expect(citationToCopy(withUnused, style("fpzg"), "s-Nenavedeni")).toBe("(Kovač, 2018)");
  });

  it("numeric: the number of a cited source, nothing for one without a number", () => {
    expect(citationToCopy(doc, style("ieee"), "s-Treći")).toBe("[2]");
    const withUnused = docOf([...sources, book("Kovač", "Nenavedeni")], cite("s-Prvi"));
    expect(citationToCopy(withUnused, style("ieee"), "s-Nenavedeni")).toBeNull();
  });

  it("nothing for an unknown or incomplete source", () => {
    expect(citationToCopy(doc, style("fpzg"), "s-nema")).toBeNull();
    const broken = docOf([{ ...book("Horvat", "Pokvaren"), publisher: "" }]);
    expect(citationToCopy(broken, style("fpzg"), "s-Pokvaren")).toBeNull();
    expect(citationToCopy(null, style("fpzg"), "s-Prvi")).toBeNull();
  });
});

describe("toSource", () => {
  it("accepts a complete source and refuses a missing or mistyped field", () => {
    expect(toSource(book("Babić", "Prvi"))).not.toBeNull();
    expect(toSource({ ...book("Babić", "Prvi"), publisher: "" })).toBeNull();
    expect(toSource({ ...book("Babić", "Prvi"), year: "2020" })).toBeNull();
    expect(toSource({ ...book("Babić", "Prvi"), authors: [] })).toBeNull();
    expect(toSource({ ...book("Babić", "Prvi"), type: "film" })).toBeNull();
  });
});

describe("effectiveStyle", () => {
  const read = (kind: "style" | "fallback" | "error" | "loading", id: "fpzg" | "ieee" = "ieee") =>
    (kind === "style" ? { kind, id, style: style(id) } : kind === "fallback" ? { kind, id: "fpzg" as const, style: style("fpzg") } : { kind }) as never;

  it("shows the institution's style with its name and where it comes from", () => {
    const e = effectiveStyle(read("style"));
    expect(e.label).toBe("Stil: IEEE (postavka ustanove)");
    expect(e.note).toBeNull();
    expect(e.style).toBe(style("ieee"));
  });

  it("a failed read keeps FPZG with a note, and is not a style label", () => {
    const e = effectiveStyle(read("error"));
    expect(e.id).toBe("fpzg");
    expect(e.style).toBe(style("fpzg"));
    expect(e.label).toBeNull();
    expect(e.note).toBe(citationStyleText.readFailed);
    expect(styledLiterature(doc, e.style).entries.map((x) => x.text)).toEqual(styledLiterature(doc, style("fpzg")).entries.map((x) => x.text));
  });

  it("an unavailable style and loading also show FPZG with their own notes", () => {
    expect(effectiveStyle(read("fallback")).note).toBe(citationStyleText.unavailableStyle);
    expect(effectiveStyle(read("loading")).note).toBe(citationStyleText.loading);
    expect(effectiveStyle(read("loading")).style).toBe(style("fpzg"));
  });
});
