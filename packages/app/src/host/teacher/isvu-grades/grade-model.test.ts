import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { alphabeticalStudents, buildBatch, gradeName, parseGradeInput } from "./grade-model";
import { isvuGradesMessages } from "./messages.hr";

const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : typeof v === "function" ? [String((v as (...a: never[]) => unknown)(...([1] as never[])))]
    : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("ISVU grade model", () => {
  it("accepts 1 to 5 and blank, rejects 0, 6, 2.5 and text", () => {
    for (const g of [1, 2, 3, 4, 5]) expect(parseGradeInput(String(g))).toEqual({ ok: true, grade: g });
    expect(parseGradeInput(" 3 ")).toEqual({ ok: true, grade: 3 });
    for (const blank of ["", "  ", null, undefined]) expect(parseGradeInput(blank)).toEqual({ ok: true, grade: null });
    for (const bad of ["0", "6", "2.5", "2,5", "abc", "-1", "1e0", "01", "٣", "10"]) expect(parseGradeInput(bad).ok).toBe(false);
  });
  it("names every grade 1 to 5", () => {
    expect([1, 2, 3, 4, 5].map((g) => gradeName(g as 1))).toEqual(["nedovoljan", "dovoljan", "dobar", "vrlo dobar", "izvrstan"]);
  });
  it("orders alphabetically by surname (hr), independent of the grade", () => {
    const list = [
      { studentId: "c", givenName: "Ana", familyName: "Šarić" },
      { studentId: "b", givenName: "Ivo", familyName: "Sabo" },
      { studentId: "a", givenName: "Eva", familyName: "Čosić" },
      { studentId: "d", givenName: "Ana", familyName: "Sabo" },
    ];
    const ids = (xs: typeof list) => alphabeticalStudents(xs).map((s) => s.studentId);
    expect(ids(list)).toEqual(["a", "d", "b", "c"]);
    expect(ids([...list].reverse())).toEqual(ids(list));
    expect(list.map((s) => s.studentId)).toEqual(["c", "b", "a", "d"]);
  });
  it("builds a batch without blanks and blocks the whole batch on any invalid entry", () => {
    expect(buildBatch({ a: "5", b: "", c: "2" })).toEqual({ ok: true, rows: [{ studentId: "a", grade: 5 }, { studentId: "c", grade: 2 }] });
    expect(buildBatch({ a: "5", b: "7", c: "x" })).toEqual({ ok: false, invalid: ["b", "c"] });
    expect(buildBatch({})).toEqual({ ok: true, rows: [] });
  });
  it("holds no forbidden term and no ranking vocabulary", () => {
    for (const value of strings(isvuGradesMessages)) {
      expect(findForbiddenTerms(value, "hr")).toEqual([]);
      expect(value).not.toMatch(/prosjek|raspodjel|rang/i);
    }
  });
});
