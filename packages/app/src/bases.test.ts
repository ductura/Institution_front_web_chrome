import { describe, expect, it } from "vitest";

import { BASE, BASES, BASE_PATH, nextPath, routerPath } from "./bases";

describe("the base", () => {
  it("is /aplikacija only (D-318): /app/web and /app/chrome are no bases", () => {
    expect(BASE_PATH).toBe("/aplikacija");
    expect(BASE).toBe("/aplikacija");
    expect([...BASES]).toEqual(["/aplikacija"]);
  });
});

describe("routerPath", () => {
  it("drops the basePath of a link's href, so router.push does not add it twice", () => {
    expect(routerPath("/aplikacija/rad/a1/predaja/pregled?izjava=t")).toBe("/rad/a1/predaja/pregled?izjava=t");
    expect(routerPath("/aplikacija/zadatak/a1")).toBe("/zadatak/a1");
    expect(routerPath("/aplikacija")).toBe("/");
    expect(routerPath("/aplikacija/")).toBe("/");
    for (const base of BASES) expect(routerPath(`${base}/rad/a1`)).toBe(nextPath(base, "/rad/a1"));
  });

  it("leaves an address without the basePath as it is", () => {
    for (const path of ["/rad/a1", "/aplikacijax/x", "/app", "/app/web/rad/a1", "#izjava"]) expect(routerPath(path)).toBe(path);
  });
});
