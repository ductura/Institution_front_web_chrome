import { describe, expect, it } from "vitest";

import { answerCell, csvCell, exportedVariables, fill, toCsv, toJson, type QuestionnaireExport } from "./model";
import { questionnaireExportText as t } from "./messages.hr";

// Invented data only.
const Q1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const Q2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const Q3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const Q4 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DATA: QuestionnaireExport = {
  schema: "questionnaire-export-v1",
  questionnaireId: "11111111-1111-4111-8111-111111111111",
  variables: [
    { questionId: Q1, order: 1, kind: "single", label: "Kompostirate li, \"da\" ili ne?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }] },
    { questionId: Q2, order: 2, kind: "multiple", label: "Što kompostirate", options: [{ code: "a", label: "Voće" }, { code: "b", label: "Lišće" }] },
    { questionId: Q3, order: 3, kind: "number", label: "Kilograma tjedno", options: [] },
    { questionId: Q4, order: 4, kind: "text", label: "Komentar", options: [] },
  ],
  rows: [
    { n: 1, values: { [Q1]: "da", [Q2]: ["a", "b"], [Q3]: 2.5, [Q4]: "=1+1" } },
    { n: 2, values: { [Q1]: "ne", [Q2]: null, [Q3]: 0 } },
  ],
  responseCount: 2,
  includesText: false,
};

describe("exported variables", () => {
  it("leave out text questions unless the server says free text is included", () => {
    expect(exportedVariables(DATA).map((v) => v.questionId)).toEqual([Q1, Q2, Q3]);
    expect(exportedVariables({ ...DATA, includesText: true }).map((v) => v.questionId)).toEqual([Q1, Q2, Q3, Q4]);
  });
});

describe("csvCell and answerCell", () => {
  it("quotes separators, quotes and line breaks; defuses formulas in text only", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell(-3)).toBe("-3");
  });
  it("reads nothing as an empty cell and several choices as joined codes", () => {
    expect(answerCell(null)).toBe("");
    expect(answerCell(undefined)).toBe("");
    expect(answerCell(["a", "b"])).toBe("a; b");
    expect(answerCell(0)).toBe(0);
    expect(answerCell({ x: 1 })).toBe("");
  });
});

describe("files", () => {
  it("the JSON holds the server's answer and the same answer gives the same bytes", () => {
    expect(JSON.parse(toJson(DATA))).toEqual(DATA);
    expect(toJson(DATA)).toBe(toJson(structuredClone(DATA)));
  });
  it("the CSV has a BOM, CRLF, one row per respondent in the server's order and one column per exported question", () => {
    const csv = toCsv(DATA, t.csvOrderHead);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const rows = csv.slice(1).split("\r\n");
    expect(rows[0]).toBe(`${t.csvOrderHead},"Kompostirate li, ""da"" ili ne?",Što kompostirate,Kilograma tjedno`);
    expect(rows[1]).toBe("1,da,a; b,2.5");
    expect(rows[2]).toBe("2,ne,,0");
    expect(rows).toHaveLength(4);
  });
  it("free text is a column only with includesText, and a formula in it is defused", () => {
    expect(toCsv(DATA, t.csvOrderHead)).not.toContain("Komentar");
    const csv = toCsv({ ...DATA, includesText: true }, t.csvOrderHead);
    expect(csv).toContain("Komentar");
    expect(csv.slice(1).split("\r\n")[1]).toBe("1,da,a; b,2.5,'=1+1");
  });
  it("carries no name, score, sum or rank column", () => {
    const head = toCsv(DATA, t.csvOrderHead).slice(1).split("\r\n")[0]!.toLowerCase();
    for (const word of ["ime", "ocjena", "zbroj", "rang", "bodov"]) expect(head).not.toContain(word);
  });
});

describe("fill", () => {
  it("puts the values in the template", () => expect(fill("od {min} do {n}", { min: 5, n: 7 })).toBe("od 5 do 7"));
});
