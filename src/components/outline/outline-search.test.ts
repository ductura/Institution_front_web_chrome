import { describe, expect, it } from "vitest";

import { activeRow, filterTree, foldHr, searchQuery } from "./outline-view";
import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";

// Invented headings only.             0       1                  2                3         4          5
const plan: [number, string, string][] = [[1, "Uvod", "1"], [2, "Izmišljeni pojmovi", "1.1"], [3, "Izmišljeni pojam", "1.1.1"],
  [1, "Četiri đaka", "2"], [2, "Uzorak (prvi) [a]", "2.1"], [3, "", "2.1.1"]];
const rows: OutlineRow[] = plan.map(([level, text, number], i) => ({ entry: { id: `n${i}`, level, text, pos: i }, number }));
const tree = outlineTree(rows);
const flat = (nodes: readonly OutlineNode[]): string[] => nodes.flatMap((n) => [`${n.index}:${n.depth}:${n.number}`, ...flat(n.children)]);
const find = (raw: string) => flat(filterTree(tree, searchQuery(raw)));

describe("search: negative inputs first (DAN-978, 978-1)", () => {
  it("has no filter for an empty or blank query", () => {
    for (const raw of ["", "   ", "\t\n"]) expect(find(raw)).toEqual(flat(tree));
  });

  it("caps a 10 000-character query at 200 code points without throwing", () => {
    expect(searchQuery("ž".repeat(10_000))).toBe(searchQuery("ž".repeat(200)));
    expect(Array.from(searchQuery("😀".repeat(300)))).toHaveLength(200);
  });

  it("takes regex characters and object keys literally", () => {
    expect(find(".*")).toEqual([]);
    expect(find("(prvi) [a]")).toEqual(["3:1:2", "4:2:2.1"]);
    expect(find("__proto__")).toEqual([]);
    expect(find("toString")).toEqual([]);
  });

  it("finds nothing in numbers or an empty title", () => {
    expect(find("1.1")).toEqual([]);
    expect(find("2")).toEqual([]);
  });

  it("folds case and Croatian letters both ways", () => {
    expect(foldHr("ČĆŽŠĐ čćžšđ Ǉ ǅ")).toBe("cczsd cczsd lj dz");
    expect(find("cetiri daka")).toEqual(["3:1:2"]);
    expect(find("UVOD")).toEqual(["0:1:1"]);
    expect(flat(filterTree(outlineTree([{ entry: { id: null, level: 1, text: "Cetvrti", pos: 0 }, number: "1" }]), searchQuery("čet")))).toEqual(["0:1:1"]);
  });

  it("marks no unrelated earlier hit when the active chapter's branch has no hit", () => {
    const hits = filterTree(tree, searchQuery("pojam"));
    expect(activeRow(hits, rows, 5, new Set(), tree)).toBe(-1);
    expect(activeRow(hits, rows, 2, new Set(), tree)).toBe(2);
  });
});

describe("a hit in a subheading shows its parents, and the input is unchanged (978-1 acceptance)", () => {
  it("keeps exactly the path 1 → 1.1 → 1.1.1 with the original index, depth and number", () => {
    const frozen = Object.freeze(rows.map((r) => Object.freeze({ ...r, entry: Object.freeze({ ...r.entry }) })));
    const full = outlineTree(frozen);
    const before = [structuredClone(frozen), structuredClone(full)];
    expect(flat(filterTree(full, searchQuery("pojam")))).toEqual(["0:1:1", "1:2:1.1", "2:3:1.1.1"]);
    expect([frozen, full]).toEqual(before);
  });

  it("marks the deepest shown node on the active chapter's path", () => {
    const hits = filterTree(tree, searchQuery("uzorak"));
    expect(activeRow(hits, rows, 5, new Set(), tree)).toBe(4);
  });
});
