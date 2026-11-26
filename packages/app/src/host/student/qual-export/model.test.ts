import { describe, expect, it } from "vitest";

import { countsByCode, csvCell, toCodebookCsv, toJson, toSegmentsCsv, type QualExport } from "./model";
import { qualExportText as t } from "./messages.hr";

// Invented data only.
const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const DATA: QualExport = {
  schema: "qualitative-export-v1",
  codebook: [{ code: C1, name: "Motivacija", description: "" }, { code: C2, name: "Prepreke", description: "Što otežava rad" }, { code: C3, name: "Podrška", description: "Bez oznaka" }],
  segments: [
    { material: M1, code: C1, paragraph: 0, start: 0, end: 5, quote: "Prvi \"citat\", s zarezom", memo: null },
    { material: M1, code: C2, paragraph: 1, start: 2, end: 9, quote: "=SUM(A1)", memo: "napomena\nu dva retka" },
    { material: M2, code: C2, paragraph: 0, start: 0, end: 4, quote: "Treći", memo: "x" },
  ],
  counts: [{ code: C1, material: M1, n: 1 }, { code: C2, material: M1, n: 1 }, { code: C2, material: M2, n: 1 }],
};

describe("counts by code", () => {
  it("follow the codebook's order, never the size, and a code without a segment counts 0", () => {
    const c = countsByCode(DATA);
    expect(c.map((x) => x.name)).toEqual(["Motivacija", "Prepreke", "Podrška"]);
    expect(c.map((x) => x.n)).toEqual([1, 2, 0]);
  });
  it("leave out counts of a code the codebook does not hold", () => {
    const c = countsByCode({ ...DATA, counts: [...DATA.counts, { code: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", material: M1, n: 9 }] });
    expect(c).toHaveLength(3);
    expect(c.reduce((a, x) => a + x.n, 0)).toBe(3);
  });
});

describe("csvCell", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("obični")).toBe("obični");
    expect(csvCell(7)).toBe("7");
  });
  it("defuses a cell a spreadsheet would run as a formula", () => {
    for (const s of ["=1+1", "+1", "-1", "@x", "\tx"]) expect(csvCell(s).replace(/^"/, "").startsWith("'")).toBe(true);
  });
});

describe("files", () => {
  it("the JSON holds the server's answer and the same answer gives the same bytes", () => {
    expect(JSON.parse(toJson(DATA))).toEqual(DATA);
    expect(toJson(DATA)).toBe(toJson(structuredClone(DATA)));
  });
  it("the segments CSV has eight columns, a BOM, CRLF and one row per segment in the server's order", () => {
    const csv = toSegmentsCsv(DATA, t.csvSegmentsHead);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(t.csvSegmentsHead).toHaveLength(8);
    const rows = csv.slice(1).split("\r\n");
    expect(rows[0]).toBe(t.csvSegmentsHead.join(","));
    expect(rows[1]).toBe(`${C1},Motivacija,${M1},0,0,5,"Prvi ""citat"", s zarezom",`);
    expect(rows[2]).toContain("'=SUM(A1)");
    expect(csv).toContain('"napomena\nu dva retka"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("the codebook CSV is in the codebook's order with the counts", () => {
    const rows = toCodebookCsv(DATA, t.csvCodebookHead).slice(1).split("\r\n");
    expect(rows.slice(1, 4)).toEqual([`${C1},Motivacija,,1`, `${C2},Prepreke,Što otežava rad,2`, `${C3},Podrška,Bez oznaka,0`]);
  });
});
