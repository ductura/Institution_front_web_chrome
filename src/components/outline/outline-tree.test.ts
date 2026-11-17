import { describe, expect, it } from "vitest";

import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";

// Invented headings only; never the text of a real work.
let pos = 0;
const row = (level: number, text: string, number: string | null = null, id: string | null = `n${pos}`): OutlineRow =>
  ({ entry: { id, level, text, pos: (pos += 10) }, number });

/** Depth-first: [depth, number ?? text] for every node. */
const flat = (nodes: readonly OutlineNode[]): [number, string | null][] =>
  nodes.flatMap((n) => [[n.depth, n.number ?? n.row.entry.text] as [number, string | null], ...flat(n.children)]);

describe("outlineTree: negative inputs first (DAN-977, 977-1)", () => {
  it("an empty list gives an empty tree", () => {
    expect(outlineTree([])).toEqual([]);
  });

  it("drops a level that is not an integer from 1 to 3 and keeps the rest", () => {
    const rows = [0, 4, -1, 1.5, Number.NaN, Infinity, -Infinity].map((l) => row(l, `Izmišljeno ${l}`));
    expect(outlineTree([...rows, row(1, "Uvod", "1")])).toEqual([
      { row: expect.objectContaining({ number: "1" }), index: 7, number: "1", depth: 1, children: [] },
    ]);
  });

  it("hangs a skipped level on the nearest earlier lower heading and keeps its number", () => {
    expect(flat(outlineTree([row(1, "Uvod", "1"), row(3, "Pojam", "1.0.1"), row(2, "Okvir", "1.1")])))
      .toEqual([[1, "1"], [2, "1.0.1"], [2, "1.1"]]);
  });

  it("makes a subheading with no parent at the start a root", () => {
    expect(flat(outlineTree([row(3, "Bilješka", "a"), row(2, "Odsječak", "b"), row(1, "Uvod", "1"), row(2, "Okvir", "1.1")])))
      .toEqual([[1, "a"], [1, "b"], [1, "1"], [2, "1.1"]]);
  });

  it("is not changed by ids like __proto__, toString, null or duplicates", () => {
    const ids = ["__proto__", "toString", null, "isti", "isti", "constructor"];
    const tree = outlineTree(ids.map((id, i) => row(1, `Izmišljeno ${i}`, String(i + 1), id)));
    expect(tree.map((n) => n.row.entry.id)).toEqual(ids);
    expect(tree.map((n) => n.number)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("passes empty numbers and blank titles through unchanged", () => {
    const rows = [row(1, "", null), row(1, "   ", ""), row(2, "\t", " ")];
    expect(outlineTree(rows).flatMap((n) => [n, ...n.children]).map((n) => [n.number, n.row.entry.text]))
      .toEqual([[null, ""], ["", "   "], [" ", "\t"]]);
  });

  it("does not change a frozen input", () => {
    const rows = Object.freeze([row(1, "Uvod", "1"), row(2, "Okvir", "1.1")].map((r) => Object.freeze(r)));
    const copy = structuredClone(rows);
    outlineTree(rows);
    expect(rows).toEqual(copy);
  });
});

describe("outlineTree: three levels with the numbering from the input (977-1 acceptance)", () => {
  it("nests 1, 2 and 3 at depth 1, 2 and 3 with the input numbers as given", () => {
    const tree = outlineTree([
      row(1, "Uvod", "1"), row(2, "Pojmovi", "1.1"), row(3, "Izmišljeni pojam", "1.1.1"),
      row(1, "Metoda", "2"), row(2, "Uzorak", "2.1"), row(3, "Odabir", "2.1.3"),
    ]);
    expect(flat(tree)).toEqual([[1, "1"], [2, "1.1"], [3, "1.1.1"], [1, "2"], [2, "2.1"], [3, "2.1.3"]]);
    expect(tree[1]!.children[0]!.children[0]!.row.entry.text).toBe("Odabir");
  });
});
