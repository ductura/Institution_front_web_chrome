import { describe, expect, it } from "vitest";

import { correlationMatrix, correlationVariables, formatNumber, formatShare, groupDigest, isDigest } from "./format";

describe("brojevi rezultata (WEB-V15-PRIKAZ-REZULTATA)", () => {
  it("koristi hrvatski decimalni zarez i najviše 6 decimala", () => {
    expect(formatNumber(3.5)).toBe("3,5");
    expect(formatNumber(0.123456)).toBe("0,123456");
    expect(formatNumber(0.1234567)).toBe("0,123457");
    expect(formatNumber(1234.5)).toBe("1234,5");
    expect(formatNumber(-0.25)).toBe("\u22120,25");
  });
  it("nula je nula, a null je „nije definirano”, nikad 0", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(null)).toBe("nije definirano");
    expect(formatNumber(null)).not.toBe(formatNumber(0));
    expect(formatNumber(Number.NaN)).toBe("nije definirano");
  });
  it("udio je postotak s jednom decimalom", () => {
    expect(formatShare(0.125)).toBe("12,5 %");
    expect(formatShare(0)).toBe("0 %");
    expect(formatShare(1)).toBe("100 %");
    expect(formatShare(null)).toBe("nije definirano");
  });
  it("otisak je samo 64 mala heksadecimalna znaka", () => {
    expect(isDigest("a".repeat(64))).toBe(true);
    expect(isDigest("A".repeat(64))).toBe(false);
    expect(isDigest("a".repeat(63))).toBe(false);
    expect(isDigest("g".repeat(64))).toBe(false);
    expect(groupDigest("0123456789abcdef".repeat(4))).toBe("0123 4567 89ab cdef ".repeat(4).trim());
  });
});

describe("matrica korelacije", () => {
  const pairs = [{ a: "x", b: "y", r: 0.5 }, { a: "x", b: "z", r: null }, { a: "y", b: "z", r: -0.25 }];
  it("zadržava redoslijed pojavljivanja, simetrična je, dijagonala je označena", () => {
    expect(correlationVariables(pairs)).toEqual(["x", "y", "z"]);
    expect(correlationMatrix(pairs)).toEqual([
      { name: "x", cells: ["diagonal", 0.5, null] },
      { name: "y", cells: [0.5, "diagonal", -0.25] },
      { name: "z", cells: [null, -0.25, "diagonal"] },
    ]);
  });
  it("par koji poslužitelj nije poslao je „nema para”, ne 0", () => {
    expect(correlationMatrix([{ a: "x", b: "y", r: 0.1 }, { a: "z", b: "z", r: 1 }])[0]?.cells).toEqual(["diagonal", 0.1, "missing"]);
  });
  it("prazan popis daje praznu matricu", () => {
    expect(correlationMatrix([])).toEqual([]);
  });
});
