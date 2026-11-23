import { describe, expect, it } from "vitest";

import { BASES, baseOfSegment, nextPath, routerPath } from "./bases";

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

describe("routerPath", () => {
  it("drops the basePath of a link's href, so router.push does not add it twice", () => {
    expect(routerPath("/app/web/rad/a1/predaja/pregled?izjava=t")).toBe("/web/rad/a1/predaja/pregled?izjava=t");
    expect(routerPath("/app/chrome/zadatak/a1")).toBe("/chrome/zadatak/a1");
    for (const base of BASES) expect(routerPath(`${base}/rad/a1`)).toBe(nextPath(base, "/rad/a1"));
  });

  it("leaves an address without the basePath as it is", () => {
    for (const path of ["/web/rad/a1", "/application/x", "/app", "#izjava"]) expect(routerPath(path)).toBe(path);
  });
});
