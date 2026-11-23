import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BREAKPOINTS, bandOf } from "./prijelomi";

const css = readFileSync(new URL("./prototip-raspored.css", import.meta.url), "utf8");

describe("prototype breakpoints", () => {
  it("falls in the four bands of the prototypes", () => {
    expect([390, 640, 641, 768, 1050, 1051, 1100, 1250, 1251, 1280].map(bandOf)).toEqual([
      "phone", "phone", "tablet", "tablet", "tablet", "laptop", "laptop", "laptop", "desktop", "desktop",
    ]);
  });

  it("writes only breakpoints the TypeScript copy knows (or 1000 for .fp)", () => {
    const known = new Set<number>([...Object.values(BREAKPOINTS), 1000]);
    const used = [...css.matchAll(/@media \((?:max|min)-width: (\d+)px\)/g)].map((m) => Number(m[1]));
    expect(used.length).toBeGreaterThan(0);
    for (const width of used) expect(known.has(width), `${width}px`).toBe(true);
    for (const [name, value] of Object.entries(BREAKPOINTS)) {
      expect(css.includes(`${value}px`), name).toBe(true);
    }
  });
});
