import { describe, expect, it } from "vitest";

import { inferKinds, looksLikeData, parseNumber } from "./infer-kinds";

describe("parseNumber", () => {
  it("takes plain numbers with a point or comma", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("-3,5")).toBe(-3.5);
    expect(parseNumber("+0.25")).toBe(0.25);
    expect(parseNumber(",5")).toBe(0.5);
  });
  it("refuses text, signs alone, exponents and thousands separators", () => {
    for (const text of ["", "-", "abc", "1e3", "1.2.3", "1,2,3", "1 000", "0x10", "NaN", "Infinity", "1,"]) {
      expect(parseNumber(text), text).toBeUndefined();
    }
  });
  it("refuses a number too large for a finite value", () => {
    expect(parseNumber("9".repeat(400))).toBeUndefined();
  });
});

describe("looksLikeData", () => {
  it("is true only when every cell is a number", () => {
    expect(looksLikeData(["1", "2,5"])).toBe(true);
    expect(looksLikeData(["1", "a"])).toBe(false);
    expect(looksLikeData([])).toBe(false);
  });
});

describe("inferKinds", () => {
  it("makes a column numeric when every filled cell is a number, otherwise a category", () => {
    const result = inferKinds(["a", "b"], [["1", "x"], ["", ""], ["2,5", "y"]]);
    expect(result).toEqual({
      ok: true,
      dataset: {
        columns: [{ name: "a", kind: "numeric" }, { name: "b", kind: "category" }],
        rows: [[1, "x"], [null, null], [2.5, "y"]],
      },
    });
  });
  it("makes an all empty column a category of nulls", () => {
    const result = inferKinds(["a"], [[""], [""]]);
    expect(result.ok && result.dataset).toEqual({ columns: [{ name: "a", kind: "category" }], rows: [[null], [null]] });
  });
  it("points at the minority cell of a mixed column", () => {
    expect(inferKinds(["a"], [["x"], ["y"], ["3"]])).toEqual({ ok: false, errors: [{ code: "mixedType", row: 3, column: 1, name: "a" }] });
  });
  it("keeps text such as 007 as a number, not a code (documented: numbers win)", () => {
    const result = inferKinds(["a"], [["007"]]);
    expect(result.ok && result.dataset.rows).toEqual([[7]]);
  });
});
