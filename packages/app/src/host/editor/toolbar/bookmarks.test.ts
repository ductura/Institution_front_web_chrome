// @vitest-environment jsdom
// ED-102: "Oznake", paragraphs marked to come back to, as the prototype's toolbar2.js menu-marks. Invented text only.
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { addBookmark, blockAt, loadBookmarks, placeBookmarks, removeBookmark, saveBookmarks } from "./bookmarks";
import { markHere } from "./ToolbarBookmarks";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const p = (n: number, text: string): JSONContent => ({ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: id(n) }, content: [{ type: "text", text }] });
const h = (n: number, text: string): JSONContent => ({ type: "heading", attrs: { level: 2, [NODE_ID_ATTRIBUTE]: id(n) }, content: [{ type: "text", text }] });

const made: Editor[] = [];
afterEach(() => { while (made.length) made.pop()!.destroy(); });
function editorWith(blocks: JSONContent[]): Editor {
  const e = new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV3(), content: { type: "doc", content: blocks } });
  made.push(e);
  return e;
}
const posIn = (e: Editor, index: number) => { let at = 0; e.state.doc.forEach((_n, offset, i) => { if (i === index) at = offset + 1; }); return at; };

describe("Oznake (ED-102)", () => {
  it("marks the paragraph at the cursor with its words and its chapter", () => {
    const e = editorWith([h(1, "Uvod"), p(2, "Izmišljeni odlomak o jednoj vrlo dugoj temi koja ne stane.")]);
    expect(blockAt(e.state.doc, posIn(e, 1))).toMatchObject({ block: id(2), label: "Izmišljeni odlomak o jednoj vrlo…", where: "Uvod" });
  });

  it("marks a paragraph once and says so the second time", () => {
    const e = editorWith([p(1, "Prvi."), p(2, "Drugi.")]);
    const one = addBookmark([], e.state.doc, posIn(e, 1), "a");
    expect(one.result).toBe("added");
    const two = addBookmark(one.marks, e.state.doc, posIn(e, 1) + 2, "b");
    expect(two.result).toBe("already");
    expect(two.marks).toHaveLength(1);
  });

  it("follows the paragraph through edits, in the text's order, and drops a deleted one", () => {
    const e = editorWith([p(1, "Prvi."), p(2, "Drugi."), p(3, "Treći.")]);
    let marks = addBookmark([], e.state.doc, posIn(e, 2), "c").marks;
    marks = addBookmark(marks, e.state.doc, posIn(e, 0), "a").marks;
    e.commands.insertContentAt(0, { type: "paragraph", content: [{ type: "text", text: "Novi početak." }] });
    const placed = placeBookmarks(marks, e.state.doc);
    expect(placed.map((m) => m.label)).toEqual(["Prvi.", "Treći."]);
    expect(e.state.doc.nodeAt(placed[1]!.pos)!.textContent).toBe("Treći.");
    expect(placeBookmarks(removeBookmark(marks, "a"), e.state.doc).map((m) => m.id)).toEqual(["c"]);
  });

  it("says how marking went from the bar", () => {
    const e = editorWith([p(1, "Prvi.")]);
    e.commands.setTextSelection(posIn(e, 0));
    const first = markHere(e, []);
    expect(first.text).toBe("Odlomak je označen. Oznake su pod gumbom Oznake.");
    expect(markHere(e, first.marks).text).toBe("Taj je odlomak već označen.");
    expect(markHere(null, []).text).toBe("Stavite pokazivač u odlomak koji želite označiti.");
  });

  it("keeps them per work in this browser and ignores what is broken", () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const marks = [{ id: "a", block: id(1), label: "Prvi.", where: "" }];
    saveBookmarks("rad-1", marks, store);
    expect(loadBookmarks("rad-1", store)).toEqual(marks);
    expect(loadBookmarks("rad-2", store)).toEqual([]);
    saveBookmarks("rad-1", [], store);
    expect(data.size).toBe(0);
    data.set("ductus:bookmarks:rad-3", "{nije json");
    expect(loadBookmarks("rad-3", store)).toEqual([]);
    expect(loadBookmarks("rad-1", null)).toEqual([]);
  });
});
