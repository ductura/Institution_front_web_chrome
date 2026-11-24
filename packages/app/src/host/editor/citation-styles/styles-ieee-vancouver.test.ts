import { describe, expect, it } from "vitest";

import ieeeConfig from "../../../../../../config/citation-styles/ieee.json";
import vancouverConfig from "../../../../../../config/citation-styles/vancouver.json";
import fpzgConfig from "../../../../../../config/faculties/fpzg/citation.json";
import {
  CitationInputError,
  CitationStyleError,
  deriveBibliography,
  formatCitation,
  formatNumberedBibliographyEntry,
  parseCitationStyle,
  type Source,
} from "../../../../../editor-core/src/document/citation";
import type { CanonicalDocumentV3, DocumentSource, NodeId, SourceId } from "../../../../../editor-core/src/document/document/schema";

// Synthetic data only: invented authors, titles and publishers.
const id = (i: number) => `${i.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa` as SourceId;
const nodeId = "00000001-1111-4111-8111-111111111111" as NodeId;
const book = (i: number, family: string): DocumentSource =>
  ({ id: id(i), type: "book", authors: [{ kind: "person", family, given: "Ana" }], year: 2020, title: `Izvor ${i}`, place: "Zagreb", publisher: "Izmišljena naklada" }) as DocumentSource;

// Cited order 3, 1, 2, 3: first citation decides numbers, not the alphabet or the array order.
function doc(): CanonicalDocumentV3 {
  return {
    schemaVersion: 3,
    sources: [book(1, "Babić"), book(2, "Anić"), book(3, "Žagar")],
    nodes: [
      {
        type: "paragraph",
        id: nodeId,
        children: [
          { type: "citation", sourceId: id(3), locator: "12-14" },
          { type: "citation", sourceId: id(1) },
          { type: "citation", sourceId: id(2) },
          { type: "citation", sourceId: id(3) },
        ],
      },
    ],
  } as CanonicalDocumentV3;
}

const styles = [
  { name: "ieee", config: ieeeConfig, open: "[", close: "]", marker: (n: number) => `[${n}]` },
  { name: "vancouver", config: vancouverConfig, open: "(", close: ")", marker: (n: number) => `${n}.` },
] as const;

describe.each(styles)("stil $name", ({ name, config, open, close, marker }) => {
  const style = parseCitationStyle(config);

  it("is accepted by parseCitationStyle as a numeric style", () => {
    expect(style.faculty).toBe(name);
    expect(style.style).toBe("numeric");
    expect(style.numeric?.open).toBe(open);
    expect(style.rangeDash).toBe("–");
  });

  it("numbers by first citation and lists in order of citation", () => {
    const bibliography = deriveBibliography(doc(), style);
    expect(bibliography.entries.map((e) => [e.sourceId, e.number])).toEqual([
      [id(3), 1],
      [id(1), 2],
      [id(2), 3],
    ]);
    expect(bibliography.entries.map((e) => e.text.slice(0, marker(1).length + 1))).toEqual([
      `${marker(1)} `,
      `${marker(2)} `,
      `${marker(3)} `,
    ]);
    expect(bibliography.entries[0]!.text).toBe(`${marker(1)} Žagar, Ana (2020) Izvor 3. Zagreb: Izmišljena naklada.`);
  });

  it("formats in-text marks with the Croatian page label and en dash", () => {
    const d = doc();
    const bibliography = deriveBibliography(d, style);
    const citations = d.nodes[0]!.children.filter((c) => c.type === "citation");
    expect(citations.map((c) => formatCitation(c as never, bibliography, style))).toEqual([
      `${open}1, str. 12–14${close}`,
      `${open}2${close}`,
      `${open}3${close}`,
      `${open}1${close}`,
    ]);
  });

  it("gives an orphan citation no number and no entry", () => {
    const d = doc();
    (d.nodes[0]!.children as unknown[]).push({ type: "citation", sourceId: id(9) });
    const bibliography = deriveBibliography(d, style);
    expect(bibliography.orphanCitations).toBe(1);
    expect(bibliography.entries).toHaveLength(3);
  });

  it("fails closed when the numeric block or a field is missing or wrong", () => {
    const { numeric: _drop, ...withoutNumeric } = config as Record<string, unknown>;
    expect(() => parseCitationStyle(withoutNumeric)).toThrow(CitationStyleError);
    expect(() => parseCitationStyle({ ...config, numeric: { ...config.numeric, listMarker: "roman" } })).toThrow(CitationStyleError);
    expect(() => parseCitationStyle({ ...config, numeric: { ...config.numeric, pageLabel: "" } })).toThrow(CitationStyleError);
    expect(() => parseCitationStyle({ ...config, style: "bibtex" })).toThrow(CitationStyleError);
    expect(() => parseCitationStyle(null)).toThrow(CitationStyleError);
  });

  it("rejects a source with missing data instead of printing a partial entry", () => {
    const bad: Source = { type: "book", authors: [], year: 2020, title: "Izvor", place: "Zagreb", publisher: "Nakladnik" };
    expect(() => formatNumberedBibliographyEntry(1, bad, style)).toThrow(CitationInputError);
  });

  it("carries provenance and rules with invented examples only", () => {
    expect(config.provenance.verified).toBe(false);
    expect(config.rules.map((r) => r.id)).toEqual(expect.arrayContaining(["in-text", "numbering", "list-order"]));
  });
});

describe("ieee and vancouver differ, and neither is the author-date style", () => {
  it("uses different list markers for the same document", () => {
    const d = doc();
    const ieee = deriveBibliography(d, parseCitationStyle(ieeeConfig)).entries[0]!.text;
    const vancouver = deriveBibliography(d, parseCitationStyle(vancouverConfig)).entries[0]!.text;
    const fpzg = deriveBibliography(d, parseCitationStyle(fpzgConfig)).entries.map((e) => e.number);
    expect(ieee.startsWith("[1] ")).toBe(true);
    expect(vancouver.startsWith("1. ")).toBe(true);
    expect(fpzg).toEqual([undefined, undefined, undefined]);
  });
});
