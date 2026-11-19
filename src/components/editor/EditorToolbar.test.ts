import { Editor, type JSONContent } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor/schema";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import EditorToolbarFor, { BLOCK_STYLES, blockStyleOf, IDLE, stateOf, TOOLS } from "./EditorToolbarFor";

/**
 * WEB-15 (E§3.6 toolbar2), on a real editor with the V2 schema: every tool
 * changes the text with V2 nodes only, the state follows the selection,
 * undo and redo work, also from Ctrl+Z and Ctrl+Y. Invented text only.
 */

const TEXT = "Izmišljena rečenica o kompostu.";
const NEXT = "Druga izmišljena rečenica.";
let open: Editor[] = [];

function sheet(content: JSONContent[] = [{ type: "paragraph", content: [{ type: "text", text: TEXT }] }]): Editor {
  const editor = new Editor({ element: null, extensions: createEditorExtensionsV2(), content: { type: "doc", content } });
  // Unmounted, the state has no plugins (history, keymaps); as in editor-core's history.test.ts.
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  open.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of open) editor.destroy();
  open = [];
});

const tool = (key: string) => TOOLS.find((candidate) => candidate.key === key)!;
const style = (key: string) => BLOCK_STYLES.find((candidate) => candidate.key === key)!;
const blocks = (editor: Editor) => (editor.getJSON().content ?? []).map((node) => node.type);

/** Every node type in the document, nested ones included. */
function types(node: JSONContent, into = new Set<string>()): Set<string> {
  if (node.type) into.add(node.type);
  for (const child of node.content ?? []) types(child, into);
  return into;
}

const V2_NODES = new Set(["doc", "paragraph", "heading", "bulletItem", "quote", "text", "citation"]);

function selectAll(editor: Editor) {
  editor.commands.setTextSelection({ from: 1, to: 1 + TEXT.length });
}

/**
 * Vitest runs without a DOM, so the editor is never mounted: it says it is
 * destroyed and not editable. This reads it as a mounted, writable one.
 */
const read = (editor: Editor) =>
  stateOf(Object.create(editor, { isEditable: { get: () => true }, isDestroyed: { get: () => false } }) as Editor);

/** A key as the browser gives it to the editor's keymaps (not a Mac: Mod is Ctrl). */
function press(editor: Editor, key: string): boolean {
  const event = { key, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, keyCode: 0, preventDefault() {} };
  const view = { state: editor.state, dispatch: (tr: unknown) => editor.view.dispatch(tr as never), editable: true };
  return editor.extensionManager.plugins.some((plugin) => plugin.props.handleKeyDown?.call(plugin, view as never, event as never));
}

describe("the toolbar's tools change the text", () => {
  it("bold and italic mark the selection and show as pressed", () => {
    const editor = sheet();
    selectAll(editor);
    tool("bold").run(editor);
    tool("italic").run(editor);
    const marks = editor.getJSON().content![0]!.content![0]!.marks!.map((mark) => mark.type);
    expect(marks).toEqual(["bold", "italic"]);
    expect(read(editor)).toMatchObject({ bold: true, italic: true });
    tool("bold").run(editor);
    expect(read(editor)).toMatchObject({ bold: false, italic: true });
  });

  it("the list and the quote are V2's bulletItem and quote, and toggle back to a paragraph", () => {
    for (const key of ["bulletItem", "quote"] as const) {
      const editor = sheet();
      tool(key).run(editor);
      expect(blocks(editor)).toEqual([key]);
      expect(read(editor)[key]).toBe(true);
      expect(blockStyleOf(read(editor))).toBeNull();
      expect([...types(editor.getJSON())].every((type) => V2_NODES.has(type))).toBe(true);
      tool(key).run(editor);
      expect(blocks(editor)).toEqual(["paragraph"]);
    }
  });

  it("every block style sets its block, and the menu names it", () => {
    const editor = sheet();
    for (const [key, level] of [["heading1", 1], ["heading2", 2], ["heading3", 3]] as const) {
      style(key).run(editor);
      expect(editor.getJSON().content![0]).toMatchObject({ type: "heading", attrs: { level } });
      expect(blockStyleOf(read(editor))).toBe(key);
    }
    style("paragraph").run(editor);
    expect(blocks(editor)).toEqual(["paragraph"]);
    expect(blockStyleOf(read(editor))).toBe("paragraph");
    expect(editor.getText()).toBe(TEXT);
  });

  it("claims no block style for a selection over blocks of two styles", () => {
    const editor = sheet([
      { type: "paragraph", content: [{ type: "text", text: TEXT }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: NEXT }] },
    ]);
    editor.commands.setTextSelection({ from: 2, to: TEXT.length + 5 });
    expect(blockStyleOf(read(editor))).toBeNull();
    editor.commands.setTextSelection(TEXT.length + 5);
    expect(blockStyleOf(read(editor))).toBe("heading2");
  });
});

describe("undo and redo", () => {
  it("the buttons undo and redo a change and are usable only when there is one", () => {
    const editor = sheet();
    expect(read(editor)).toMatchObject({ canUndo: false, canRedo: false });
    tool("quote").run(editor);
    expect(read(editor)).toMatchObject({ canUndo: true, canRedo: false });
    tool("undo").run(editor);
    expect(blocks(editor)).toEqual(["paragraph"]);
    expect(read(editor).canRedo).toBe(true);
    tool("redo").run(editor);
    expect(blocks(editor)).toEqual(["quote"]);
  });

  it("Ctrl+Z and Ctrl+Y do the same from the keyboard", () => {
    const editor = sheet();
    tool("bulletItem").run(editor);
    expect(press(editor, "z")).toBe(true);
    expect(blocks(editor)).toEqual(["paragraph"]);
    expect(press(editor, "y")).toBe(true);
    expect(blocks(editor)).toEqual(["bulletItem"]);
  });

  it("nothing is usable in an editor that may not be written in", () => {
    const editor = sheet();
    tool("quote").run(editor);
    expect(read(editor).canUndo).toBe(true);
    const locked = Object.create(editor, { isEditable: { get: () => false }, isDestroyed: { get: () => false } }) as Editor;
    expect(stateOf(locked)).toMatchObject({ editable: false, quote: true, canUndo: false, canRedo: false });
    expect(stateOf(editor)).toBe(IDLE);
    expect(stateOf(null)).toBe(IDLE);
  });
});

describe("the toolbar as rendered", () => {
  const render = (editor: Editor | null) => renderToStaticMarkup(createElement(EditorToolbarFor, { editor }));

  it("shows icons named by aria-label and title, with the prototype's shortcuts", () => {
    const html = render(sheet());
    for (const key of ["undo", "redo", "bold", "italic", "bulletItem", "quote"]) {
      expect(html).toContain(`data-tool="${key}"`);
    }
    expect(html).toContain(`aria-label="${t.toolbar.undo}"`);
    expect(html).toContain(`title="${t.toolbar.undo} (Ctrl+Z)"`);
    expect(html).toContain('aria-keyshortcuts="Control+Y"');
    expect(html.match(/<svg/g)?.length).toBe(6);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain("Naslov 1");
  });

  it("without an editor every control says it is unavailable and stays reachable", () => {
    const html = render(null);
    expect(html.match(/aria-disabled="true"/g)?.length).toBe(TOOLS.length);
    expect(html).toContain(`>${t.toolbar.blockStyle}<`);
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
  });
});
