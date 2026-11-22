import { expect, it } from "vitest";
import { parseBibtex, parseRis, planImport } from "./import-refs";

const BIB = `@book{kovac2019,
  author = {Kovač, Ana and Marko Horvat},
  title = {Pisanje rada},
  year = {2019},
  publisher = {Naklada},
  address = {Zagreb}
}
@article{peric2020,
  author = {Perić, Iva},
  title = {Članak o izvorima},
  journal = {Časopis},
  year = {2020},
  pages = {1--9}
}
@book{bez,
  author = {Nitko, Ana},
  title = {Bez nakladnika},
  year = {2018}
}`;
const RIS = `TY  - JOUR
AU  - Perić, Iva
TI  - Članak o izvorima
JO  - Časopis
PY  - 2020
SP  - 1
EP  - 9
ER  -
`;

it("parses BibTeX and RIS", () => {
  const [book] = parseBibtex(BIB);
  expect(book).toMatchObject({ type: "book", year: 2019, title: "Pisanje rada", place: "Zagreb" });
  expect(book?.authors).toEqual([{ kind: "person", family: "Kovač", given: "Ana" }, { kind: "person", family: "Horvat", given: "Marko" }]);
  expect(parseRis(RIS)[0]).toMatchObject({ type: "article", journal: "Časopis", pages: "1–9" });
});

it("imports valid records, skips doubles and counts incomplete ones", () => {
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const first = planImport(BIB, [], id, "2026-11-22");
  expect(first).toMatchObject({ kind: "done", skippedDuplicates: 0, incomplete: 1 });
  expect(first.added.map((s) => s.title)).toEqual(["Pisanje rada", "Članak o izvorima"]);
  const again = planImport(BIB, first.added, id, "2026-11-22");
  expect(again).toMatchObject({ added: [], skippedDuplicates: 2, incomplete: 1 });
  expect(planImport("nema zapisa", [], id, "2026-11-22").kind).toBe("none");
});
