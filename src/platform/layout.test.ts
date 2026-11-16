import { describe, expect, it } from "vitest";
import { layoutForWidth, meetsTargetSize, TARGET_MIN_AA, targetMinSize } from "./layout.ts";

describe("layoutForWidth", () => {
  it("puts the catalogue widths in the expected layout", () => {
    expect([360, 390, 768, 1024, 1440].map(layoutForWidth)).toEqual(["phone", "phone", "tablet", "desktop", "desktop"]);
  });

  it("splits exactly at the @media limits", () => {
    expect([640, 640.5, 799.98, 799.99, 800].map(layoutForWidth)).toEqual(["phone", "tablet", "tablet", "desktop", "desktop"]);
  });

  it("gives the narrowest layout for a width that is not a number", () => {
    expect([Number.NaN, -1, Infinity, -Infinity].map(layoutForWidth)).toEqual(["phone", "phone", "phone", "phone"]);
    expect(layoutForWidth(0)).toBe("phone");
  });
});

describe("touch targets", () => {
  it("uses the WCAG 2.2 AA minimum of 24 px", () => {
    expect(TARGET_MIN_AA).toBe(24);
    expect(meetsTargetSize({ width: 24, height: 24 })).toBe(true);
    expect(meetsTargetSize({ width: 23.9, height: 44 })).toBe(false);
    expect(meetsTargetSize({ width: Number.NaN, height: 44 })).toBe(false);
  });

  it("asks for 44 px, 32 px only in dense bars with a fine pointer", () => {
    expect(targetMinSize("fine")).toBe(44);
    expect(targetMinSize("fine", true)).toBe(32);
    expect(targetMinSize("coarse", true)).toBe(44);
    for (const p of ["fine", "coarse"] as const) for (const d of [false, true]) expect(targetMinSize(p, d)).toBeGreaterThanOrEqual(TARGET_MIN_AA);
    expect(meetsTargetSize({ width: 44, height: 44 }, targetMinSize("coarse"))).toBe(true);
  });
});
