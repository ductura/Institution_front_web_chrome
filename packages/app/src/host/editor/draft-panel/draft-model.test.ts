import { describe, expect, it } from "vitest";

import { chapterNumberVector, moveChapter } from "../../../../../editor-core/src/outline/index.ts";

import { cleanNote, draftRows, dragSteps, loadNotes, MAX_NOTE_LENGTH, noteStorageKey, pruneNotes, saveNotes, siblingKeys, withNote } from "./draft-model";

// WEB-1609: invented headings only.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const heading = (n: number, level: 1 | 2 | 3, title: string) => ({ type: "heading" as const, id: id(n), level, children: [{ type: "text" as const, text: title, marks: [] }] });
const para = (n: number, text: string) => ({ type: "paragraph" as const, id: id(n), children: [{ type: "text" as const, text, marks: [] }] });
const work = {
  schemaVersion: 1 as const,
  nodes: [heading(1, 1, "Uvod"), para(2, "a"), heading(3, 1, "Metoda"), heading(4, 2, "Uzorak"), heading(5, 2, "Postupak"), heading(6, 1, "Zaključak")],
};
const entries = [
  { key: id(1), id: id(1), level: 1, number: "1", title: "Uvod" },
  { key: id(3), id: id(3), level: 1, number: "2", title: "Metoda" },
  { key: id(4), id: id(4), level: 2, number: "2.1", title: "Uzorak" },
  { key: id(5), id: id(5), level: 2, number: "2.2", title: "Postupak" },
  { key: id(6), id: id(6), level: 1, number: "3", title: "Zaključak" },
];

describe("moving a chapter", () => {
  it("keeps every block id and renumbers from the projection", () => {
    const moved = moveChapter(work as never, id(3), "up") as unknown as typeof work;
    expect(moved.nodes.map((n) => n.id).sort()).toEqual(work.nodes.map((n) => n.id).sort());
    expect(chapterNumberVector(moved as never)).toEqual([[id(3), "1"], [id(4), "1.1"], [id(5), "1.2"], [id(1), "2"], [id(6), "3"]]);
  });
});

describe("dragSteps", () => {
  it("counts the swaps between siblings", () => {
    expect(dragSteps(entries, id(6), id(1))).toEqual({ direction: "up", times: 2 });
    expect(dragSteps(entries, id(1), id(6))).toEqual({ direction: "down", times: 2 });
    expect(dragSteps(entries, id(5), id(4))).toEqual({ direction: "up", times: 1 });
  });
  it("refuses other levels, other parents and itself", () => {
    expect(dragSteps(entries, id(4), id(1))).toBeNull();
    expect(dragSteps(entries, id(1), id(1))).toBeNull();
    expect(dragSteps(entries, "missing", id(1))).toBeNull();
    expect(siblingKeys(entries, id(4))).toEqual([id(4), id(5)]);
  });
});

describe("chapter notes", () => {
  it("are kept apart from the document: moving and noting change nothing in each other", () => {
    const notes = withNote({}, id(3), "samo za mene");
    const moved = moveChapter(work as never, id(3), "up");
    expect(JSON.stringify(moved)).not.toContain("samo za mene");
    expect(notes[id(3)]).toBe("samo za mene");
    expect(draftRows(entries, notes).find((r) => r.key === id(3))?.hasNote).toBe(true);
  });
  it("are cleaned, limited and dropped when blank or when the chapter is gone", () => {
    expect(cleanNote("a\u0000b")).toBe("ab");
    expect(cleanNote("x".repeat(MAX_NOTE_LENGTH + 5))).toHaveLength(MAX_NOTE_LENGTH);
    expect(withNote({ [id(1)]: "x" }, id(1), "  ")).toEqual({});
    expect(pruneNotes({ [id(1)]: "x", [id(9)]: "y" }, [id(1)])).toEqual({ [id(1)]: "x" });
  });
  it("round-trip through storage and survive broken storage", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(saveNotes(storage, "w1", { [id(1)]: "bilješka" })).toBe(true);
    expect(loadNotes(storage, "w1")).toEqual({ [id(1)]: "bilješka" });
    expect(loadNotes(storage, "w2")).toEqual({});
    data.set(noteStorageKey("w3"), "{broken");
    expect(loadNotes(storage, "w3")).toEqual({});
    data.set(noteStorageKey("w4"), "[1]");
    expect(loadNotes(storage, "w4")).toEqual({});
    expect(saveNotes(null, "w1", {})).toBe(false);
    expect(saveNotes({ getItem: () => null, setItem: () => { throw new Error("full"); } }, "w1", {})).toBe(false);
  });
});
