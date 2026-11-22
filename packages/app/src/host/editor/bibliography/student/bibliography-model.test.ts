import { expect, it } from "vitest";
import { bibSources, citePlaces, missingFields, possibleDuplicates, relianceNotes, sourceStats } from "./bibliography-model";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const book = (id: string, title: string, family = "Kovač") => ({
  id, type: "book", authors: [{ kind: "person", family, given: "Ana" }], year: 2019, title, place: "Zagreb", publisher: "Naklada",
});
const cite = (sourceId: string, locator: string | null = "14") => ({ type: "citation", attrs: { sourceId, locator } });
const par = (...content: object[]) => ({ type: "paragraph", content });
const h = (level: number) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: "Naslov" }] });
const doc = (content: object[]) => ({ type: "doc", attrs: { sources: [book(A, "Prvi"), book(B, "Drugi", "Horvat")] }, content });

it("labels sources and numbers chapters", () => {
  const d = doc([h(1), par({ type: "text", text: "Tvrdnja " }, cite(A)), h(1), h(2), par(cite(B, null))]);
  expect(bibSources(d).map((s) => s.label)).toEqual(["Kovač (2019)", "Horvat (2019)"]);
  expect(citePlaces(d).map((p) => [p.sourceId, p.chapter, p.page])).toEqual([[A, "1", "14"], [B, "2.1", null]]);
  expect(citePlaces(d)[0]?.sentence).toBe("Tvrdnja (…)");
});

it("counts citations per source and flags a chapter leaning on one source", () => {
  const d = doc([h(1), par(cite(A), cite(A), cite(A), cite(B), cite(A))]);
  const sources = bibSources(d);
  const places = citePlaces(d);
  expect(sourceStats(sources, places, new Map([[A, 2]])).map((s) => [s.places.length, s.proofs])).toEqual([[4, 2], [1, 0]]);
  expect(relianceNotes(sources, places)).toMatchObject([{ chapter: "1", count: 4, total: 5 }]);
  expect(relianceNotes(sources, places.slice(0, 4))).toEqual([]);
});

it("names missing fields and finds doubled titles", () => {
  expect(missingFields({ type: "web", authors: [], year: 2020, title: "X", url: "", accessed: "2026-01-01" }))
    .toEqual(["autor", "adresa"]);
  expect(missingFields(book(A, "T"))).toEqual([]);
  const sources = bibSources(doc([]));
  expect(possibleDuplicates(sources)).toEqual([]);
  expect(possibleDuplicates(bibSources({ attrs: { sources: [book(A, "Isti naslov!"), book(B, "isti  NASLOV")] } })))
    .toHaveLength(1);
});
