import { describe, expect, it } from "vitest";

import { EMPTY_TOC, tableOfContents, type TocSnapshot } from "../../../../../editor-core/src/outline/index.ts";

import { moveButtons, outlineEntriesOf, tocCopyText } from "./toc-model";

// WEB-1602 (M5.3): the host draws the projection's numbers as they are, keyed
// by block id. Invented headings only.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const heading = (n: number, level: 1 | 2 | 3, title: string) => ({
  type: "heading" as const, id: id(n), level, children: title ? [{ type: "text" as const, text: title, marks: [] }] : [],
});
const work = {
  schemaVersion: 1 as const,
  nodes: [heading(1, 1, "Uvod"), heading(2, 2, "Cilj rada"), heading(3, 3, ""), heading(4, 1, "Zaključak")],
};

/** A snapshot built from the canonical projection, as the editor's store gives it. */
function snapshotOf(editable: boolean, extra: Partial<TocSnapshot> = {}): TocSnapshot {
  const entries = tableOfContents(work as never).map((e) => ({ key: e.blockId, id: e.blockId, level: e.level, number: e.number, title: e.title }));
  return { entries, currentKey: id(2), canMoveUp: false, canMoveDown: true, editable, ...extra };
}

describe("outlineEntriesOf", () => {
  it("passes the projection's numbers and block ids through unchanged", () => {
    expect(outlineEntriesOf(snapshotOf(true))).toEqual([
      { id: id(1), number: "1", title: "Uvod", level: 1 },
      { id: id(2), number: "1.1", title: "Cilj rada", level: 2 },
      { id: id(3), number: "1.1.1", title: "", level: 3 },
      { id: id(4), number: "2", title: "Zaključak", level: 1 },
    ]);
  });
  it("is empty for an empty work", () => {
    expect(outlineEntriesOf(EMPTY_TOC)).toEqual([]);
  });
});

describe("tocCopyText", () => {
  it("copies the numbered headings indented by level, an empty one named", () => {
    expect(tocCopyText(snapshotOf(true))).toBe("1. Uvod\n  1.1. Cilj rada\n    1.1.1. Bez naslova\n2. Zaključak");
  });
});

describe("moveButtons", () => {
  it("follows what the chapter with the cursor can do", () => {
    expect(moveButtons(snapshotOf(true))).toEqual({ up: false, down: true });
  });
  it("offers no move in a read-only work or a work without headings", () => {
    expect(moveButtons(snapshotOf(false))).toBeNull();
    expect(moveButtons({ ...EMPTY_TOC, editable: true })).toBeNull();
  });
});
