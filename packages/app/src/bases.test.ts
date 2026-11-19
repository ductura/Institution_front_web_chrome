import { describe, expect, it } from "vitest";

import { BASES, baseOfSegment } from "./bases";

describe("baseOfSegment", () => {
  it("gives the base of app/[base]/ for web and chrome", () => {
    expect(baseOfSegment("web")).toBe("/app/web");
    expect(baseOfSegment("chrome")).toBe("/app/chrome");
    expect(BASES.map((b) => baseOfSegment(b.slice("/app/".length)))).toEqual([...BASES]);
  });

  it("gives null for every other segment, so the page is not found", () => {
    for (const segment of ["", "Web", "admin", "web/", "_next", "..", "web%2F"]) expect(baseOfSegment(segment)).toBeNull();
  });
});
