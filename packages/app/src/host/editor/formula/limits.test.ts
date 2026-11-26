import { describe, expect, it } from "vitest";
import { checkFormulaLimit, codePointLength, MAX_FORMULA_TEX_CODE_POINTS, MAX_INLINE_FORMULA_TEX_CODE_POINTS } from "./limits.ts";

describe("formula limits", () => {
  it("uses the schema constants", () => {
    expect(MAX_FORMULA_TEX_CODE_POINTS).toBe(4000);
    expect(MAX_INLINE_FORMULA_TEX_CODE_POINTS).toBe(1000);
  });
  it("counts code points, not UTF-16 units", () => {
    expect(codePointLength("😀😀")).toBe(2);
    expect(checkFormulaLimit("😀".repeat(1000), "inline").ok).toBe(true);
    expect(checkFormulaLimit("😀".repeat(1001), "inline").reason).toBe("too-long");
  });
  it("rejects empty and blank input", () => {
    expect(checkFormulaLimit("", "block").reason).toBe("empty");
    expect(checkFormulaLimit("  \n", "inline").reason).toBe("empty");
  });
  it("allows exactly the limit and rejects one more", () => {
    expect(checkFormulaLimit("x".repeat(4000), "block").ok).toBe(true);
    expect(checkFormulaLimit("x".repeat(4001), "block").reason).toBe("too-long");
    expect(checkFormulaLimit("x".repeat(1001), "inline").ok).toBe(false);
    expect(checkFormulaLimit("x".repeat(1001), "block").ok).toBe(true);
  });
});
