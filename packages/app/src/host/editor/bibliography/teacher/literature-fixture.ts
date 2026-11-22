/** An invented document for the tests of this folder (no real people or texts). */
export const A = "00000000-0000-4000-8000-00000000000a";
export const B = "00000000-0000-4000-8000-00000000000b";
export const C = "00000000-0000-4000-8000-00000000000c";
export const DOC = {
  schemaVersion: 3,
  sources: [
    { id: A, type: "book", authors: [{ kind: "person", family: "Izmišljena", given: "Ana" }], year: 2015, title: "Priručnik za pisanje", place: "Zagreb", publisher: "Nakladnik A" },
    { id: B, type: "article", authors: [{ kind: "person", family: "Autor", given: "B" }, { kind: "person", family: "Drugi", given: "C" }], year: 2019, title: "Članak o metodama", journal: "Časopis X" },
    { id: C, type: "web", authors: [{ kind: "organization", name: "Zavod za primjere", acronym: "ZZP" }], year: 2021, title: "Mrežna stranica", url: "https://example.org", accessed: "2026-11-01" },
  ],
  nodes: [
    { type: "heading", id: "h1", level: 1, children: [{ type: "text", text: "Uvod", marks: [] }] },
    { type: "paragraph", id: "p1", children: [
      { type: "text", text: "Rečenica ", marks: [] },
      { type: "citation", sourceId: A, locator: "14", rq: "00000000-0000-4000-8000-0000000000f1" },
      { type: "citation", sourceId: A },
      { type: "citation", sourceId: B, locator: null, rq: null },
    ] },
  ],
};
