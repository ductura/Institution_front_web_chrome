// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { tiptapToCanonical } from "../editor/interop";
import { createEditorExtensions, NODE_ID_ATTRIBUTE } from "../editor/schema";

import {
  canMoveChapter,
  chapterNumberVector,
  ChapterMove,
  ChapterNumbers,
  createTocStore,
  goToHeading,
  headingPosition,
  moveChapterInEditor,
  tocSnapshot,
  type TocSnapshot,
} from "./index";

/**
 * WEB-1602 (M5.3): the live table of contents in the editor. It refreshes on
 * every change that alters a line, keeps quiet otherwise, follows block ids
 * through a chapter move and its undo, and shows the numbers the export
 * carries. Invented text only.
 */

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Spec = ["p" | 1 | 2 | 3, string];

function editorOf(blocks: readonly Spec[], editable = true): Editor {
  const editor = new Editor({
    element: null,
    editable,
    extensions: [...createEditorExtensions(), ChapterNumbers, ChapterMove],
    content: {
      type: "doc",
      content: blocks.map(([kind, text], i) => ({
        type: kind === "p" ? "paragraph" : "heading",
        attrs: kind === "p" ? { [NODE_ID_ATTRIBUTE]: ID(i + 1) } : { [NODE_ID_ATTRIBUTE]: ID(i + 1), level: kind },
        ...(text ? { content: [{ type: "text", text }] } : {}),
      })),
    },
  });
  // Without a DOM the editor's state starts without the extension plugins (history, keymaps).
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}

const WORK: Spec[] = [
  [1, "Uvod"],
  ["p", "Prvi izmišljeni odlomak."],
  [2, "Cilj rada"],
  ["p", "Drugi odlomak."],
  [1, "Okvir"],
  ["p", "Treći odlomak."],
  [1, "Zaključak"],
];

const lines = (s: TocSnapshot) => s.entries.map((e) => `${e.number} ${e.title}`);
const blockIds = (editor: Editor) => {
  const out: string[] = [];
  editor.state.doc.forEach((n) => out.push(String(n.attrs[NODE_ID_ATTRIBUTE])));
  return out;
};
/** The numbers of the canonical document, as the export reads them. */
const exported = (editor: Editor) => {
  const c = tiptapToCanonical(editor.getJSON());
  if (!c.ok) throw new Error("not canonical");
  return chapterNumberVector(c.doc);
};
/** Types at the cursor, as a keystroke would (insertContent needs a DOM). */
const type = (editor: Editor, text: string) => editor.view.dispatch(editor.state.tr.insertText(text));
const cursorTo = (editor: Editor, key: string) => editor.commands.setTextSelection(headingPosition(editor.state, key)! + 1);

describe("tocSnapshot", () => {
  it("lists every heading with its number, the current chapter and the moves it allows", () => {
    const editor = editorOf(WORK);
    cursorTo(editor, ID(5));
    const s = tocSnapshot(editor.state, true);
    expect(lines(s)).toEqual(["1 Uvod", "1.1 Cilj rada", "2 Okvir", "3 Zaključak"]);
    expect(s.entries.map((e) => e.key)).toEqual([ID(1), ID(3), ID(5), ID(7)]);
    expect(s).toMatchObject({ currentKey: ID(5), canMoveUp: true, canMoveDown: true, editable: true });
    editor.destroy();
  });

  it("matches the numbers the export carries, by block id", () => {
    const editor = editorOf(WORK);
    expect(tocSnapshot(editor.state, true).entries.map((e) => [e.id, e.number])).toEqual(exported(editor));
    editor.destroy();
  });

  it("allows no move in a read-only work or above the first heading", () => {
    const editor = editorOf([["p", "Prije."], ...WORK], false);
    editor.commands.setTextSelection(1);
    expect(tocSnapshot(editor.state, false)).toMatchObject({ currentKey: null, canMoveUp: false, canMoveDown: false });
    cursorTo(editor, ID(6));
    expect(tocSnapshot(editor.state, false)).toMatchObject({ canMoveUp: false, canMoveDown: false, editable: false });
    expect(moveChapterInEditor(editor, "up")).toBe(false);
    editor.destroy();
  });
});

describe("createTocStore: the table of contents refreshes live", () => {
  it("tells the view when a heading is added, renamed or renumbered, and not while typing in a paragraph", () => {
    const editor = editorOf(WORK);
    const store = createTocStore(editor);
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    const first = store.getSnapshot();

    // Typing inside a paragraph changes no line.
    editor.commands.setTextSelection(headingPosition(editor.state, ID(5))! - 2);
    const before = store.getSnapshot();
    type(editor, " još");
    expect(store.getSnapshot()).toBe(before);

    // Renaming a heading.
    cursorTo(editor, ID(3));
    type(editor, "Novi ");
    expect(lines(store.getSnapshot())).toEqual(["1 Uvod", "1.1 Novi Cilj rada", "2 Okvir", "3 Zaključak"]);

    // A paragraph turned into a heading renumbers the ones after it.
    editor.commands.setTextSelection(headingPosition(editor.state, ID(5))! - 2);
    editor.commands.setNode("heading", { level: 1 });
    expect(lines(store.getSnapshot())).toEqual(["1 Uvod", "1.1 Novi Cilj rada", "2 Drugi odlomak još.", "3 Okvir", "4 Zaključak"]);

    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).not.toBe(first);
    stop();
    const calls = listener.mock.calls.length;
    type(editor, "x");
    expect(listener.mock.calls.length).toBe(calls);
    editor.destroy();
  });

  it("tells every view, not only the first that subscribed", () => {
    const editor = editorOf(WORK);
    const store = createTocStore(editor);
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = store.subscribe(first);
    const stopSecond = store.subscribe(second);
    cursorTo(editor, ID(1));
    type(editor, "Novi ");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    type(editor, "x");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopSecond();
    editor.destroy();
  });

  it("is empty without an editor", () => {
    const store = createTocStore(null);
    expect(store.getSnapshot().entries).toEqual([]);
    store.subscribe(() => {})();
  });
});

describe("a chapter move keeps every id and the export numbers follow", () => {
  it("moves the chapter with its subchapters and paragraphs, and undo brings it back", () => {
    const editor = editorOf(WORK);
    const start = blockIds(editor);
    cursorTo(editor, ID(5));
    expect(moveChapterInEditor(editor, "up")).toBe(true);

    expect(blockIds(editor)).toEqual([ID(5), ID(6), ID(1), ID(2), ID(3), ID(4), ID(7)]);
    expect([...blockIds(editor)].sort()).toEqual([...start].sort());
    const s = tocSnapshot(editor.state, true);
    expect(lines(s)).toEqual(["1 Okvir", "2 Uvod", "2.1 Cilj rada", "3 Zaključak"]);
    // The cursor stays in the moved heading, so the next Alt+Shift+↑/↓ moves it again.
    expect(s.currentKey).toBe(ID(5));
    expect(exported(editor)).toEqual(s.entries.map((e) => [e.id, e.number]));

    // The cut and the insert are one undo step.
    editor.commands.undo();
    expect(blockIds(editor)).toEqual(start);
    editor.commands.redo();
    expect(blockIds(editor)[0]).toBe(ID(5));
    editor.destroy();
  });

  it("keeps the ids of repeated blocks (empty paragraphs, the same text) in both chapters, and through undo", () => {
    const editor = editorOf([
      [1, "Uvod"], ["p", ""], ["p", ""], ["p", "Isti odlomak."],
      [1, "Okvir"], ["p", ""], ["p", ""], ["p", "Isti odlomak."],
      [1, "Zaključak"], ["p", ""],
    ]);
    const start = blockIds(editor);
    expect(moveChapterInEditor(editor, "down", ID(1))).toBe(true);
    expect(blockIds(editor)).toEqual([ID(5), ID(6), ID(7), ID(8), ID(1), ID(2), ID(3), ID(4), ID(9), ID(10)]);
    expect(moveChapterInEditor(editor, "down", ID(1))).toBe(true);
    expect(blockIds(editor)).toEqual([ID(5), ID(6), ID(7), ID(8), ID(9), ID(10), ID(1), ID(2), ID(3), ID(4)]);
    expect(moveChapterInEditor(editor, "up", ID(9))).toBe(true);
    expect(blockIds(editor)).toEqual([ID(9), ID(10), ID(5), ID(6), ID(7), ID(8), ID(1), ID(2), ID(3), ID(4)]);
    editor.commands.undo();
    editor.commands.undo();
    editor.commands.undo();
    expect(blockIds(editor)).toEqual(start);
    editor.commands.redo();
    expect(blockIds(editor)).toEqual([ID(5), ID(6), ID(7), ID(8), ID(1), ID(2), ID(3), ID(4), ID(9), ID(10)]);
    editor.destroy();
  });

  it("moves down by key and by Alt+Shift+ArrowDown", () => {
    const editor = editorOf(WORK);
    expect(canMoveChapter(editor.state, "down", ID(7))).toBe(false);
    expect(canMoveChapter(editor.state, "down", ID(1))).toBe(true);
    expect(moveChapterInEditor(editor, "down", ID(1))).toBe(true);
    expect(blockIds(editor)).toEqual([ID(5), ID(6), ID(1), ID(2), ID(3), ID(4), ID(7)]);

    cursorTo(editor, ID(1));
    const event = new KeyboardEventStub("ArrowDown", { altKey: true, shiftKey: true }) as unknown as KeyboardEvent;
    const handled = editor.state.plugins.some((plugin) => plugin.props.handleKeyDown?.call(plugin, editor.view, event) === true);
    expect(handled).toBe(true);
    expect(blockIds(editor)).toEqual([ID(5), ID(6), ID(7), ID(1), ID(2), ID(3), ID(4)]);
    editor.destroy();
  });

  it("a jump from the table of contents finds the heading by id after the move", () => {
    const editor = editorOf(WORK);
    moveChapterInEditor(editor, "down", ID(1));
    expect(goToHeading(editor, ID(3))).toBe(true);
    expect(editor.state.doc.resolve(editor.state.selection.from).parent.attrs[NODE_ID_ATTRIBUTE]).toBe(ID(3));
    expect(goToHeading(editor, ID(99))).toBe(false);
    editor.destroy();
  });
});

/** The parts of a KeyboardEvent ProseMirror's keymap reads, for a test without a DOM. */
class KeyboardEventStub {
  readonly ctrlKey: boolean = false;
  readonly metaKey: boolean = false;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly keyCode = 0;
  constructor(readonly key: string, mods: { altKey?: boolean; shiftKey?: boolean }) {
    this.altKey = mods.altKey ?? false;
    this.shiftKey = mods.shiftKey ?? false;
  }
  preventDefault() {}
}
