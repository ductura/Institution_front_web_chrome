import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";

const level = fc.oneof(fc.integer({ min: -1, max: 5 }), fc.double(), fc.constantFrom(Number.NaN, Infinity));
const id = fc.oneof(fc.constant(null), fc.constantFrom("__proto__", "toString", "isti"), fc.string());
const rowArb: fc.Arbitrary<OutlineRow> = fc.record({
  entry: fc.record({ id, level, text: fc.string({ maxLength: 40 }), pos: fc.nat() }),
  number: fc.option(fc.string({ maxLength: 8 })),
});
const valid = (r: OutlineRow) => Number.isInteger(r.entry.level) && r.entry.level >= 1 && r.entry.level <= 3;
const walk = (nodes: readonly OutlineNode[]): OutlineNode[] => nodes.flatMap((n) => [n, ...walk(n.children)]);

describe("outlineTree properties (DAN-977, 977-1)", () => {
  it("keeps every valid row once, in order, with its number, and leaves the input alone", () => {
    fc.assert(fc.property(fc.array(rowArb, { maxLength: 60 }), (rows) => {
      const before = structuredClone(rows);
      const nodes = walk(outlineTree(rows));
      const kept = rows.filter(valid);
      expect(nodes.map((n) => n.row)).toEqual(kept);
      expect(nodes.every((n, i) => n.row === kept[i] && n.number === kept[i]!.number)).toBe(true);
      expect(rows).toEqual(before);
    }));
  });

  it("never nests deeper than three, and a child is always of a higher level than its parent", () => {
    fc.assert(fc.property(fc.array(rowArb, { maxLength: 60 }), (rows) => {
      for (const n of walk(outlineTree(rows))) {
        expect(n.depth).toBeGreaterThanOrEqual(1);
        expect(n.depth).toBeLessThanOrEqual(3);
        for (const c of n.children) {
          expect(c.row.entry.level).toBeGreaterThan(n.row.entry.level);
          expect(c.depth).toBe(n.depth + 1);
        }
      }
    }));
  });
});
