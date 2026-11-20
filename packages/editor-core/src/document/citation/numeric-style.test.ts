import { describe, expect, it } from "vitest";

import fpzgConfig from "../../../../../config/faculties/fpzg/citation.json";
import type { CanonicalDocumentV3, DocumentSource, NodeId, SourceId } from "../document/schema";
import { validateVersionedDocument } from "../document/validate";
import { CitationStyleError, deriveBibliography, formatCitation, parseCitationStyle } from "./index";

// Synthetic data only. The numeric catalog entry is a test input: the real
// shape comes from the institution catalog (settings.values.get citation.style).
const numericConfig = (listMarker: string) => ({
  ...fpzgConfig,
  style: "numeric",
  numeric: { open: "[", close: "]", listMarker, pageLabel: "str. ", pageSeparator: ", " },
});

const id = (i: number) => `${i.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa` as SourceId;
const nodeId = "00000001-1111-4111-8111-111111111111" as NodeId;
const book = (i: number): DocumentSource =>
  ({ id: id(i), type: "book", authors: [{ kind: "person", family: `Prezime${i}`, given: "Ime" }], year: 2020, title: `Izvor ${i}`, place: "Mjesto", publisher: "Nakladnik" }) as DocumentSource;

function doc(): CanonicalDocumentV3 {
  const result: CanonicalDocumentV3 = {
    schemaVersion: 3,
    sources: [book(1), book(2)],
    nodes: [
      {
        type: "paragraph",
        id: nodeId,
        children: [
          { type: "citation", sourceId: id(2), locator: "12-14" },
          { type: "footnote", text: "Objašnjenje." },
          { type: "citation", sourceId: id(1) },
          { type: "citation", sourceId: id(2) },
        ],
      },
    ],
  };
  expect(validateVersionedDocument(result)).toMatchObject({ ok: true });
  return result;
}

describe("numeric citation styles", () => {
  it("parses a numeric style and still parses author-date", () => {
    expect(parseCitationStyle(numericConfig("bracket")).numeric?.listMarker).toBe("bracket");
    expect(parseCitationStyle(fpzgConfig).numeric).toBeUndefined();
  });

  it("fails closed on a numeric style without its block or with a bad marker", () => {
    expect(() => parseCitationStyle({ ...fpzgConfig, style: "numeric" })).toThrow(CitationStyleError);
    expect(() => parseCitationStyle(numericConfig("roman"))).toThrow(CitationStyleError);
  });

  it("numbers sources by first citation and formats [n] with the page range", () => {
    const style = parseCitationStyle(numericConfig("bracket"));
    const d = doc();
    const bibliography = deriveBibliography(d, style);
    expect(bibliography.entries.map((e) => [e.sourceId, e.number])).toEqual([
      [id(2), 1],
      [id(1), 2],
    ]);
    const citations = d.nodes[0]!.children.filter((c) => c.type === "citation");
    expect(citations.map((c) => formatCitation(c as never, bibliography, style))).toEqual([
      "[1, str. 12–14]",
      "[2]",
      "[1]",
    ]);
    expect(bibliography.entries[0]!.text.startsWith("[1] Prezime2, Ime (2020) ")).toBe(true);
  });

  it("uses the dot list marker when the style says so", () => {
    const style = parseCitationStyle(numericConfig("dot"));
    expect(deriveBibliography(doc(), style).entries[1]!.text.startsWith("2. ")).toBe(true);
  });
});
