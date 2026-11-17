// Ported from Ductus src/lib/i18n/hr.test.ts at 9c45857 (DAN-871, 871-1): the
// pluralHr and countHr blocks as they are, for the forms ../i18n/hr.ts carries.
import { describe, expect, it } from "vitest";

import { countHr, pluralHr } from "./hr.ts";

describe("pluralHr", () => {
  const rad = (n: number) => pluralHr(n, "rad", "rada", "radova");

  it("takes the first form for 1", () => {
    expect(rad(1)).toBe("rad");
  });

  it("takes the second form for 2, 3 and 4", () => {
    expect([rad(2), rad(3), rad(4)]).toEqual(["rada", "rada", "rada"]);
  });

  it("takes the third form for 5 and for 0", () => {
    expect(rad(5)).toBe("radova");
    expect(rad(0)).toBe("radova");
  });

  it("takes the third form across the whole 11–14 band", () => {
    expect([rad(11), rad(12), rad(13), rad(14)]).toEqual([
      "radova",
      "radova",
      "radova",
      "radova",
    ]);
  });

  it("returns to the first form at 21 and at 101", () => {
    expect(rad(21)).toBe("rad");
    expect(rad(101)).toBe("rad");
  });

  it("returns to the second form at 22", () => {
    expect(rad(22)).toBe("rada");
  });

  it("keeps the third form at 111, where 11 wins over the last digit", () => {
    expect(rad(111)).toBe("radova");
    expect(rad(112)).toBe("radova");
  });

  it("answers a negative count by its magnitude", () => {
    expect(rad(-1)).toBe("rad");
    expect(rad(-12)).toBe("radova");
  });

  it("answers a fractional count by its integer part", () => {
    expect(rad(1.9)).toBe("rad");
  });
});

describe("countHr", () => {
  it("puts the number in front of the form it agrees with", () => {
    expect(countHr(1, "rad", "rada", "radova")).toBe("1 rad");
    expect(countHr(3, "rad", "rada", "radova")).toBe("3 rada");
    expect(countHr(11, "rad", "rada", "radova")).toBe("11 radova");
  });
});
