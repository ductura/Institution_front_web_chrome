import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { filterTree, foldHr, searchQuery } from "./outline-view";
import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";

const words = fc.constantFrom("Uvod", "Čvor", "đak", "pojam", "Ž", "a.b", "(x)", " ", "Lj");
const rowArb: fc.Arbitrary<OutlineRow> = fc.record({
  entry: fc.record({ id: fc.constant(null), level: fc.integer({ min: 0, max: 4 }), text: fc.array(words, { maxLength: 4 }).map((w) => w.join("")), pos: fc.nat() }),
  number: fc.option(fc.string({ maxLength: 4 })),
});
const walk = (nodes: readonly OutlineNode[]): OutlineNode[] => nodes.flatMap((n) => [n, ...walk(n.children)]);
const hit = (n: OutlineNode, q: string) => foldHr(n.row.entry.text).includes(q);

describe("filterTree properties (DAN-978, 978-1)", () => {
  it("keeps every hit and only hits and their ancestors, in order, unchanged, and the input alone", () => {
    fc.assert(fc.property(fc.array(rowArb, { maxLength: 30 }), fc.nat(40), fc.nat(6), (rows, at, len) => {
      const before = structuredClone(rows);
      const tree = outlineTree(rows);
      const all = walk(tree);
      const source = all.length > 0 ? foldHr(all[at % all.length]!.row.entry.text) : "";
      const q = searchQuery(source.slice(0, len));
      const result = filterTree(tree, q);
      const kept = walk(result);
      if (q === "") expect(result).toEqual(tree);
      for (const n of all) if (hit(n, q)) expect(kept.some((k) => k.index === n.index)).toBe(true);
      for (const k of kept) {
        expect(hit(k, q) || walk(k.children).some((c) => hit(c, q))).toBe(true);
        const original = all.find((n) => n.index === k.index)!;
        expect([k.number, k.depth, k.row]).toEqual([original.number, original.depth, original.row]);
      }
      expect(kept.map((k) => k.index)).toEqual([...kept.map((k) => k.index)].sort((a, b) => a - b));
      expect(rows).toEqual(before);
    }));
  });
});
