import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { OUTLINE_HR } from "../i18n/hr.ts";
import { activeRow, branchIndexes, collapsedSet, limitLevels, openBranchShown } from "./outline-view";
import { outlineTree, type OutlineRow } from "./outline-tree";

// Invented headings only. Index:   0      1        2          3     4       5        6
const levels = [1, 2, 3, 1, 2, 3, 4];
const rows: OutlineRow[] = levels.map((level, i) => ({ entry: { id: `n${i}`, level, text: `Izmišljeno ${i}`, pos: i * 10 }, number: null }));
const tree = outlineTree(rows);
const at = (active: number, collapsed: readonly number[] = []) => activeRow(tree, rows, active, collapsedSet(tree, collapsed));

describe("activeRow and collapsedSet: negative inputs first (DAN-977, 977-3)", () => {
  it("marks nothing for an index outside the rows", () => {
    for (const a of [-1, rows.length, 1.5, Number.NaN, -Infinity, Infinity]) expect(at(a)).toBe(-1);
  });

  it("marks nothing when the active row comes before every shown row", () => {
    const leading = [{ entry: { id: null, level: 4, text: "Četiri", pos: 0 }, number: null }, ...rows];
    expect(activeRow(outlineTree(leading), leading, 0, new Set())).toBe(-1);
    expect(activeRow([], [], 0, new Set())).toBe(-1);
  });

  it("keeps only indexes of shown rows with children, once each", () => {
    expect([...collapsedSet(tree, [-1, 99, 1.5, Number.NaN, 2, 6, 0, 0, 3])].sort()).toEqual([0, 3]);
  });

  it("does not change its input", () => {
    const collapsed = Object.freeze([0]);
    const copy = structuredClone(rows);
    at(2, collapsed);
    expect(rows).toEqual(copy);
    expect(collapsed).toEqual([0]);
  });
});

describe("the active chapter stays marked once through collapsing (977-3 acceptance)", () => {
  it("marks a visible active chapter itself", () => {
    expect(at(2)).toBe(2);
    expect(at(4, [0])).toBe(4);
  });

  it("marks the collapsed ancestor that hides it, one or two levels up", () => {
    expect(at(2, [1])).toBe(1);
    expect(at(2, [0])).toBe(0);
    expect(at(2, [0, 1])).toBe(0);
  });

  it("gives a heading outside levels 1 to 3 to the nearest earlier shown row", () => {
    expect(at(6)).toBe(5);
    expect(at(6, [3])).toBe(3);
    const odd = [rows[0]!, { ...rows[1]!, entry: { ...rows[1]!.entry, level: 0 } }, { ...rows[2]!, entry: { ...rows[2]!.entry, level: Number.NaN } }];
    expect(activeRow(outlineTree(odd), odd, 1, new Set())).toBe(0);
    expect(activeRow(outlineTree(odd), odd, 2, new Set())).toBe(0);
  });
});

describe("collapse all (DAN-978, 978-2)", () => {
  it("lists no branch for an empty tree or one of leaves only", () => {
    expect(branchIndexes([])).toEqual([]);
    expect(branchIndexes(outlineTree([rows[0]!, rows[3]!]))).toEqual([]);
    expect(openBranchShown([], new Set())).toBe(false);
  });

  it("lists every branch in order", () => {
    expect(branchIndexes(tree)).toEqual([0, 1, 3, 4]);
  });

  it("sees an open branch only where it is shown", () => {
    expect(openBranchShown(tree, collapsedSet(tree, []))).toBe(true);
    expect(openBranchShown(tree, collapsedSet(tree, [0, 3]))).toBe(false);
    expect(openBranchShown(tree, collapsedSet(tree, [0, 4]))).toBe(true);
    expect(openBranchShown(tree, collapsedSet(tree, [1, 7, -1, 1.5, 3, 3, 4, 0]))).toBe(false);
    expect(openBranchShown(tree, collapsedSet(tree, [7, -1, 2, 6]))).toBe(true);
  });
});

describe("levels choice (DAN-979, 979-3)", () => {
  const flat = (nodes: readonly { index: number; children: readonly unknown[] }[]): number[] =>
    nodes.flatMap((n) => [n.index, ...flat(n.children as never)]);

  it("means no limit for a level outside 1 to 3 or not an integer", () => {
    for (const levels of [0, 4, 1.5, Number.NaN, -1]) expect(flat(limitLevels(tree, levels))).toEqual(flat(tree));
  });

  it("keeps headings up to the chosen level, with their index and depth", () => {
    expect(flat(limitLevels(tree, 1))).toEqual([0, 3]);
    expect(flat(limitLevels(tree, 2))).toEqual([0, 1, 3, 4]);
    expect(flat(limitLevels(tree, 3))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(limitLevels(tree, 2)[1]!.children[0]).toMatchObject({ index: 4, depth: 2 });
  });

  it("measures the heading level, not the depth, past a skipped level", () => {
    const skip = outlineTree([rows[0]!, rows[2]!]);
    expect(flat(skip)).toEqual([0, 1]);
    expect(flat(limitLevels(skip, 2))).toEqual([0]);
  });

  it("leaves no branch to collapse at level 1, and marks the visible ancestor", () => {
    expect(branchIndexes(limitLevels(tree, 1))).toEqual([]);
    expect(activeRow(limitLevels(tree, 1), rows, 2, new Set(), tree)).toBe(0);
    expect(activeRow(limitLevels(tree, 2), rows, 2, new Set(), tree)).toBe(1);
  });
});

describe("panel texts of src/components/i18n (DAN-977)", () => {
  it("use no forbidden term", () => {
    expect(findForbiddenTerms(Object.values(OUTLINE_HR).join(" "))).toEqual([]);
  });
});
