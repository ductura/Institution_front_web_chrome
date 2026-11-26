import { describe, expect, it } from "vitest";

import fpzgConfig from "../../../../../config/faculties/fpzg/citation.json";
import type { CanonicalDocumentV3, DocumentNodeV3, DocumentSource, NodeId, SourceId } from "../document/schema";
import { deriveFootnoteNotes, parseCitationStyle } from "./index";

/** Synthetic data only. */
const style = parseCitationStyle(fpzgConfig);
const sid = (i: number) => `${i.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa` as SourceId;
const nid = (i: number) => `${i.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111` as NodeId;
const book = (i: number, family = `Prezime${i}`): DocumentSource =>
  ({ id: sid(i), type: "book", authors: [{ kind: "person", family, given: "Ime" }], year: 2020, title: `Izvor ${i}`, place: "Mjesto", publisher: "Nakladnik" }) as DocumentSource;

type Child = { type: "citation"; sourceId: SourceId; locator?: string; via?: string } | { type: "footnote"; text: string };
const doc = (sources: DocumentSource[], children: Child[]): CanonicalDocumentV3 => ({
  schemaVersion: 3,
  nodes: [{ type: "paragraph", id: nid(1), children } as unknown as DocumentNodeV3],
  sources,
});
const cite = (i: number, locator?: string, via?: string): Child => ({ type: "citation", sourceId: sid(i), ...(locator ? { locator } : {}), ...(via ? { via } : {}) });
const texts = (d: CanonicalDocumentV3) => deriveFootnoteNotes(d, style).map((n) => n.text);

describe("deriveFootnoteNotes (F4-EDI-R19)", () => {
  it("has no notes without citations", () => {
    expect(deriveFootnoteNotes(doc([book(1)], []), style)).toEqual([]);
  });

  it("gives the full entry, then Ibid., then nav. dj. after another source", () => {
    const n = deriveFootnoteNotes(doc([book(1), book(2)], [cite(1, "9"), cite(1, "10-12"), cite(1), cite(2), cite(1, "4")]), style);
    expect(n.map((x) => x.kind)).toEqual(["full", "ibid", "ibid", "full", "short"]);
    expect(n[0]!.text).toMatch(/^Prezime1, Ime \(2020\) Izvor 1\. .*, str\. 9\.$/);
    expect(n[1]!.text).toBe("Ibid, str. 10–12.");
    expect(n[2]!.text).toBe("Ibid.");
    expect(n[4]!.text).toBe("Prezime1, nav. dj., str. 4.");
    expect(n.map((x) => x.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("lets a plain footnote break the Ibid. sequence", () => {
    const t = texts(doc([book(1)], [cite(1), { type: "footnote", text: "Obična bilješka." }, cite(1, "3")]));
    expect(t[1]).toBe("Obična bilješka.");
    expect(t[2]).toBe("Prezime1, nav. dj., str. 3.");
  });

  it("writes cit. prema for a secondary source and never Ibid. after it", () => {
    const t = texts(doc([book(1)], [cite(1, "5", "Drugi, Autor (2019)"), cite(1, "6")]));
    expect(t[0]).toMatch(/^Drugi, Autor \(2019\), cit\. prema: Prezime1, Ime \(2020\) Izvor 1\. .*, str\. 5\.$/);
    expect(t[1]).toBe("Prezime1, nav. dj., str. 6.");
  });

  it("shows an unknown source honestly and breaks the sequence", () => {
    const d = doc([book(1)], [cite(1), cite(9), cite(1)]);
    const n = deriveFootnoteNotes(d, style);
    expect(n.map((x) => x.kind)).toEqual(["full", "orphan", "short"]);
    expect(n[1]!.text).toBe("Izvor nije u popisu.");
  });

  it("is pure: the same document gives the same notes and is not changed", () => {
    const d = doc([book(1)], [cite(1), cite(1)]);
    const copy = JSON.stringify(d);
    expect(deriveFootnoteNotes(d, style)).toEqual(deriveFootnoteNotes(d, style));
    expect(JSON.stringify(d)).toBe(copy);
  });
});
