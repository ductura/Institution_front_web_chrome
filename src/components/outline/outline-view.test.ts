import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { OUTLINE_HR } from "../i18n/hr.ts";
import { activeRow, collapsedSet } from "./outline-view";
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

describe("panel texts of src/components/i18n (DAN-977)", () => {
  it("use no forbidden term", () => {
    expect(findForbiddenTerms(Object.values(OUTLINE_HR).join(" "))).toEqual([]);
  });
});
