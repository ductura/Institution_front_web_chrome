// @vitest-environment jsdom
// ED-48 (P2-24): "Prikaži samo ovo poglavlje" hides the rest of the work on screen only; the text stays whole.
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { createTocStore } from "../../../../../editor-core/src/outline/index.ts";
import { chapterRange, onlyChapterKey, onlyChapterPlugin, showOnlyChapter } from "./only-chapter";

const heading = (level: number, text: string): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const para = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const WORK: JSONContent = {
  type: "doc",
  content: [heading(1, "Uvod"), para("Prvi odlomak."), heading(2, "Pitanje"), para("Drugi odlomak."), heading(1, "Zaključak"), para("Zadnji odlomak.")],
};

let current: Editor | null = null;
afterEach(() => { current?.destroy(); current = null; });

function editorWith(): Editor {
  current = new Editor({ element: document.createElement("div"), enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content: WORK });
  current.registerPlugin(onlyChapterPlugin());
  return current;
}
const keys = (editor: Editor): [string, string, string] => {
  const [a, b, c] = createTocStore(editor).getSnapshot().entries.map((e) => e.key);
  if (!a || !b || !c) throw new Error("three headings expected");
  return [a, b, c];
};
const hiddenTexts = (editor: Editor) =>
  [...editor.view.dom.children].filter((el) => (el as HTMLElement).style.display === "none").map((el) => el.textContent);

describe("only one chapter on screen", () => {
  it("hides everything outside the chapter, subchapters included, and leaves the text whole", () => {
    const editor = editorWith();
    const before = JSON.stringify(editor.getJSON());
    const [uvod] = keys(editor);
    showOnlyChapter(editor, uvod);
    expect(onlyChapterKey(editor.state)).toBe(uvod);
    expect(hiddenTexts(editor)).toEqual(["Zaključak", "Zadnji odlomak."]);
    expect(JSON.stringify(editor.getJSON())).toBe(before);
    expect(editor.can().undo()).toBe(false);
  });

  it("a subchapter ends at the next heading of its level or higher", () => {
    const editor = editorWith();
    showOnlyChapter(editor, keys(editor)[1]);
    expect(hiddenTexts(editor)).toEqual(["Uvod", "Prvi odlomak.", "Zaključak", "Zadnji odlomak."]);
    const pos = editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize;
    expect(chapterRange(editor.state.doc, pos)?.end).toBe(pos + editor.state.doc.child(2).nodeSize + editor.state.doc.child(3).nodeSize);
    expect(chapterRange(editor.state.doc, 1)).toBeNull();
  });

  it("follows writing inside the chapter and shows the whole work again on request", () => {
    const editor = editorWith();
    showOnlyChapter(editor, keys(editor)[0]);
    editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize, para("Novi odlomak."));
    expect(hiddenTexts(editor)).toEqual(["Zaključak", "Zadnji odlomak."]);
    showOnlyChapter(editor, null);
    expect(onlyChapterKey(editor.state)).toBeNull();
    expect(hiddenTexts(editor)).toEqual([]);
  });

  it("does nothing when the plugin is not registered", () => {
    current = new Editor({ element: document.createElement("div"), enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content: WORK });
    showOnlyChapter(current, "heading-0");
    expect(onlyChapterKey(current.state)).toBeNull();
  });
});
