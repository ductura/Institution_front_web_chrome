// @vitest-environment jsdom
// PIL-K-TRAKA: the host toolbar in the student's tools slot works over the same editor as the copied toolbar did:
// each of its tools gives the very document the copied toolbar's tool gave, labels and shortcuts stay, and the
// V2 schema's missing numbered list is not offered.
import { Editor } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { BLOCK_STYLES, stateOf, TOOLS } from "../../../../../../src/components/editor/EditorToolbarFor.tsx";
import { EditorToolbarHost } from "./EditorToolbarHost";
import { KEPT_LABELS, KEPT_TOOLBAR_LABEL, toolbarCommands, toolbarStateOf } from "./StudentToolbar";
import { toolbarGroups } from "./toolbar-model";

const ID = "00000000-0000-4000-8000-000000000001";
const made: Editor[] = [];
function editorWith(): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const e = new Editor({
    element, extensions: createEditorExtensionsV3(),
    content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Izmišljeni odlomak." }] }] },
  });
  e.commands.setTextSelection({ from: 1, to: 9 });
  made.push(e);
  return e;
}
afterEach(() => { while (made.length) made.pop()!.destroy(); });

const KEYS = ["bold", "italic", "bulletItem", "quote"] as const;
const COMMAND = { bold: "toggleBold", italic: "toggleItalic", bulletItem: "toggleBulletList", quote: "toggleQuote" } as const;

describe("student toolbar over the editor", () => {
  it.each(KEYS)("%s gives the document the copied toolbar's tool gave", (key) => {
    const [a, b] = [editorWith(), editorWith()];
    toolbarCommands(a)[COMMAND[key]]();
    TOOLS.find((t) => t.key === key)!.run(b);
    expect(a.getJSON()).toEqual(b.getJSON());
    expect(toolbarStateOf(stateOf(a))).toEqual(toolbarStateOf(stateOf(b)));
  });

  it("undo and redo run only when the editor can", () => {
    const e = editorWith();
    const run = toolbarCommands(e);
    const before = JSON.stringify(e.getJSON());
    run.undo();
    expect(JSON.stringify(e.getJSON())).toBe(before);
    run.toggleBold();
    expect(toolbarStateOf(stateOf(e)).canUndo).toBe(true);
    run.undo();
    expect(JSON.stringify(e.getJSON())).toBe(before);
    expect(toolbarStateOf(stateOf(e)).canRedo).toBe(true);
    run.redo();
    expect(toolbarStateOf(stateOf(e)).bold).toBe(true);
  });

  it.each(BLOCK_STYLES)("block style $key gives the same document", (style) => {
    const [a, b] = [editorWith(), editorWith()];
    toolbarCommands(a).setBlock(style.key);
    style.run(b);
    expect(a.getJSON()).toEqual(b.getJSON());
    expect(toolbarStateOf(stateOf(a)).block).toBe(style.key);
  });

  it("does nothing while the editor cannot be written in", () => {
    const e = editorWith();
    e.setEditable(false);
    const before = JSON.stringify(e.getJSON());
    const run = toolbarCommands(e);
    run.toggleBold(); run.setBlock("heading2"); run.toggleQuote();
    expect(JSON.stringify(e.getJSON())).toBe(before);
    expect(toolbarStateOf(stateOf(e)).editable).toBe(false);
  });

  it("has no block style claimed inside a quote, and never a numbered list", () => {
    const e = editorWith();
    toolbarCommands(e).toggleQuote();
    const state = toolbarStateOf(stateOf(e));
    expect(state.block).toBeNull();
    expect(state.numberedList).toBe(false);
  });

  it("keeps the labels and the shortcuts of the copied toolbar", () => {
    const e = editorWith();
    const groups = toolbarGroups(toolbarStateOf(stateOf(e)), toolbarCommands(e));
    const shown = groups.flatMap((g) => g.actions.map((a) => ({ ...a, label: KEPT_LABELS[a.id as keyof typeof KEPT_LABELS] ?? a.label })));
    for (const tool of TOOLS.filter((t) => t.key !== "blockStyle")) {
      const action = shown.find((a) => a.label === tool.label);
      expect(action, tool.label).toBeTruthy();
      if (tool.keys) expect(action!.shortcut, tool.label).toBe(tool.keys.replace("Ctrl", "Control"));
    }
    for (const style of BLOCK_STYLES) expect(shown.some((a) => a.label === style.label), style.label).toBe(true);
  });

  it("keeps the copied toolbar's own name for the bar", () => {
    const e = editorWith();
    expect(KEPT_TOOLBAR_LABEL).toBe("Oblikovanje teksta");
    const html = renderToStaticMarkup(createElement(EditorToolbarHost, {
      state: toolbarStateOf(stateOf(e)), commands: toolbarCommands(e), label: KEPT_TOOLBAR_LABEL, labels: KEPT_LABELS, omit: ["numberedList"],
    }));
    expect(html).toContain('role="toolbar" aria-label="Oblikovanje teksta"');
  });
});
