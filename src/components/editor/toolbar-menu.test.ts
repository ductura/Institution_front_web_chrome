import { Editor, type JSONContent } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV2 } from "@/editor/schema";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import {
  COLLAPSE_ORDER, convertBlock, copyText, glyphOf, insertChar, insertHole, MAX_COLLAPSED, menuKey, openerKey,
  pushRecent, readRecent, rovingIndex, SPECIAL_CHARS, splitTools, writeRecent,
} from "./toolbar-menu";

const TOOLS = ["undo", "redo", "blockStyle", "bold", "italic", "bulletItem", "quote"]
  .map((key) => ({ key }));
const keys = (tools: { key: string }[]) => tools.map((tool) => tool.key);

describe("toolbar roving focus", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(rovingIndex("ArrowRight", 0, 4)).toBe(1);
    expect(rovingIndex("ArrowRight", 3, 4)).toBe(0);
    expect(rovingIndex("ArrowLeft", 0, 4)).toBe(3);
    expect(rovingIndex("Home", 2, 4)).toBe(0);
    expect(rovingIndex("End", 0, 4)).toBe(3);
  });

  it("ignores other keys, focus outside the buttons and an empty toolbar", () => {
    expect(rovingIndex("ArrowDown", 1, 4)).toBe(-1);
    expect(rovingIndex("Tab", 1, 4)).toBe(-1);
    expect(rovingIndex("ArrowRight", -1, 4)).toBe(-1);
    expect(rovingIndex("ArrowRight", 0, 0)).toBe(-1);
  });
});

describe("menu button", () => {
  it("opens on the first item with ArrowDown and on the last with ArrowUp", () => {
    expect(openerKey("ArrowDown")).toBe("first");
    expect(openerKey("ArrowUp")).toBe("last");
  });

  it("leaves Enter and Space to the button's own click, so one press never opens and closes", () => {
    expect(openerKey("Enter")).toBeNull();
    expect(openerKey(" ")).toBeNull();
    expect(openerKey("ArrowRight")).toBeNull();
  });
});

describe("open menu", () => {
  it("moves with the arrows, wraps, and jumps with Home and End", () => {
    expect(menuKey("ArrowDown", 0, 3)).toEqual({ kind: "move", to: 1 });
    expect(menuKey("ArrowDown", 2, 3)).toEqual({ kind: "move", to: 0 });
    expect(menuKey("ArrowUp", 0, 3)).toEqual({ kind: "move", to: 2 });
    expect(menuKey("Home", 2, 3)).toEqual({ kind: "move", to: 0 });
    expect(menuKey("End", 0, 3)).toEqual({ kind: "move", to: 2 });
  });

  it("closes on Escape, even when empty", () => {
    expect(menuKey("Escape", 1, 3)).toEqual({ kind: "close" });
    expect(menuKey("Escape", 0, 0)).toEqual({ kind: "close" });
  });

  it("leaves Enter, Space, Tab and other keys to the item and the browser", () => {
    for (const key of ["Enter", " ", "Tab", "a", "ArrowLeft"]) expect(menuKey(key, 0, 3)).toBeNull();
    expect(menuKey("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("tools that do not fit", () => {
  it("all stay on the toolbar until the toolbar is too narrow", () => {
    const { shown, more } = splitTools(TOOLS, 0);
    expect(keys(shown)).toEqual(keys(TOOLS));
    expect(more).toEqual([]);
  });

  it("move to Više by the prototype priority, redo first, in toolbar order inside the menu (WEB-15)", () => {
    expect(keys(splitTools(TOOLS, 1).more)).toEqual(["redo"]);
    expect(keys(splitTools(TOOLS, 2).more)).toEqual(["redo", "quote"]);
    expect(keys(splitTools(TOOLS, 3).more)).toEqual(["redo", "bulletItem", "quote"]);
    expect(keys(splitTools(TOOLS, 3).shown)).toEqual(["undo", "blockStyle", "bold", "italic"]);
  });

  it("never moves undo, the block style, bold or italic, whatever the count", () => {
    expect(MAX_COLLAPSED).toBe(COLLAPSE_ORDER.length);
    for (const collapsed of [-1, 1, 2, 3, 6, 99]) {
      const { shown, more } = splitTools(TOOLS, collapsed);
      expect(keys(shown)).toEqual(expect.arrayContaining(["undo", "blockStyle", "bold", "italic"]));
      expect(shown.length + more.length).toBe(TOOLS.length);
    }
    expect(splitTools(TOOLS, -1).more).toEqual([]);
    expect(keys(splitTools(TOOLS, 99).more)).toEqual(["redo", "bulletItem", "quote"]);
  });
});

describe("WEB-6C menus (E§3.3, E§3.6)", () => {
  const sheet = (content: JSONContent[] = [{ type: "paragraph", content: [{ type: "text", text: "Izmišljena rečenica." }] }]) => {
    const editor = new Editor({ element: null, extensions: createEditorExtensionsV2(), content: { type: "doc", content } });
    // Unmounted, the state has no plugins; as in EditorToolbar.test.ts.
    editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
    // And the editor says it is not editable; read it as a writable one.
    Object.defineProperty(editor, "isEditable", { get: () => true, configurable: true });
    Object.defineProperty(editor, "isDestroyed", { get: () => false, configurable: true });
    return editor;
  };
  const blocks = (e: Editor) => (e.getJSON().content ?? []).map((n) => n.type);

  it("keeps 28 distinct special characters, every one described in the catalogue", () => {
    expect(SPECIAL_CHARS).toHaveLength(28);
    expect(new Set(SPECIAL_CHARS).size).toBe(28);
    for (const ch of SPECIAL_CHARS) expect(t.toolbar.specialChars[ch]).toBeTruthy();
  });

  it("puts the newest character first, without a repeat, at most seven", () => {
    expect(pushRecent(["a", "b"], "b")).toEqual(["b", "a"]);
    expect(pushRecent(["1", "2", "3", "4", "5", "6", "7"], "x")).toEqual(["x", "1", "2", "3", "4", "5", "6"]);
    expect(glyphOf(" ")).toBe("⎵");
  });

  it("works without storage: nothing is read, nothing throws", () => {
    expect(readRecent()).toEqual([]);
    expect(() => writeRecent(["„"])).not.toThrow();
  });

  it("inserts a listed character at the caret and refuses any other", () => {
    const editor = sheet();
    editor.commands.setTextSelection(1);
    expect(insertChar(editor, "§")).toBe(true);
    expect(editor.getText()).toBe("§Izmišljena rečenica.");
    expect(insertChar(editor, "x")).toBe(false);
    expect(insertChar(null, "§")).toBe(false);
  });

  it("marks a place to come back to with [?]", () => {
    const editor = sheet();
    editor.commands.setTextSelection(1);
    expect(insertHole(editor)).toBe(true);
    expect(editor.getText().startsWith("[?] ")).toBe(true);
  });

  it("turns a paragraph into a quote and back, and does nothing when it is already so", () => {
    const editor = sheet();
    editor.commands.setTextSelection(1);
    expect(convertBlock(editor, "paragraph")).toBe(false);
    expect(convertBlock(editor, "quote")).toBe(true);
    expect(blocks(editor)).toEqual(["quote"]);
    expect(convertBlock(editor, "quote")).toBe(false);
    expect(convertBlock(editor, "paragraph")).toBe(true);
    expect(blocks(editor)).toEqual(["paragraph"]);
  });

  it("writes nothing into an editor that may not be written in", () => {
    const editor = sheet();
    Object.defineProperty(editor, "isEditable", { get: () => false, configurable: true });
    const locked = editor;
    expect(insertChar(locked, "§")).toBe(false);
    expect(insertHole(locked)).toBe(false);
    expect(convertBlock(locked, "quote")).toBe(false);
  });

  it("copies the plain text of the sheet, and says so when the browser refuses", async () => {
    const editor = sheet();
    let copied = "";
    vi.stubGlobal("navigator", { clipboard: { writeText: async (text: string) => { copied = text; } } });
    expect(await copyText(editor)).toBe(true);
    expect(copied).toBe("Izmišljena rečenica.");
    vi.stubGlobal("navigator", { clipboard: { writeText: async () => { throw new Error("denied"); } } });
    expect(await copyText(editor)).toBe(false);
    vi.unstubAllGlobals();
  });
});
