// @vitest-environment jsdom
// jsdom: a headless editor (element: null) reads as destroyed, so the palette would only see a locked work.
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { ASK_COMMENT_EVENT } from "../../../../packages/app/src/host/editor/comments/ask-comment";
import { offerSlashCommands } from "../../../../packages/app/src/host/editor/slash-commands";
import { NEW_SOURCE_REQUEST } from "../../../../packages/app/src/host/editor/sources-mention/new-source-request";
import { OPEN_PANEL_EVENT } from "../layout-prefs/open-panel";
import { PRINT_PREVIEW_EVENT } from "../print-export/print-event";
import { paletteActions } from "./palette";

// ED-92: the palette's Umetni items, Komentar and Pregled ispisa go through the same doors as the toolbar.
// Invented text.
function editorWith(editable: boolean) {
  return new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV2(), editable, content: {
    type: "doc", content: [
      { type: "paragraph", attrs: { nodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, content: [{ type: "text", text: "Izmišljen tekst o mostovima." }] },
    ] } });
}
const find = (editor: Editor, id: string) => paletteActions(editor as never, () => {}).find((a) => a.id === id)!;
function heard(name: string) {
  const got: unknown[] = [];
  const on = (event: Event) => { got.push((event as CustomEvent<unknown>).detail); event.preventDefault(); };
  document.addEventListener(name, on);
  return { got, stop: () => document.removeEventListener(name, on) };
}

afterEach(() => { vi.useRealTimers(); });

describe("palette Umetni, Komentar and Pregled ispisa (ED-92)", () => {
  it("opens Novi izvor in the quick source dialog once the palette has closed", () => {
    vi.useFakeTimers();
    const editor = editorWith(true);
    const quick = heard(NEW_SOURCE_REQUEST);
    const panel = heard(OPEN_PANEL_EVENT);
    const item = find(editor, "newSource");
    expect(item.disabled).toBe(false);
    item.run!();
    expect(quick.got).toHaveLength(0);
    vi.runAllTimers();
    expect(quick.got).toHaveLength(1);
    expect(panel.got).toEqual([]);
    quick.stop(); panel.stop(); editor.destroy();
  });

  it("opens Literatura for Navod when no source list is on the page", () => {
    vi.useFakeTimers();
    const editor = editorWith(true);
    const panel = heard(OPEN_PANEL_EVENT);
    find(editor, "cite").run!();
    vi.runAllTimers();
    expect(panel.got).toEqual(["sources"]);
    panel.stop(); editor.destroy();
  });

  it("offers Fusnota and Unakrsna referenca only when the toolbar offers them", () => {
    vi.useFakeTimers();
    const editor = editorWith(true);
    expect(find(editor, "footnote").disabled).toBe(true);
    expect(find(editor, "xref").disabled).toBe(true);
    const opened: string[] = [];
    const withdraw = offerSlashCommands(editor, { fusnota: () => opened.push("fusnota"), ref: () => opened.push("ref") });
    find(editor, "footnote").run!();
    find(editor, "xref").run!();
    vi.runAllTimers();
    expect(opened).toEqual(["fusnota", "ref"]);
    withdraw(); editor.destroy();
  });

  it("offers Fraza only when the toolbar offers /fraza, and opens it once the palette has closed (ED-122)", () => {
    vi.useFakeTimers();
    const editor = editorWith(true);
    expect(find(editor, "phrase").disabled).toBe(true);
    const opened: string[] = [];
    const withdraw = offerSlashCommands(editor, { fraza: () => opened.push("fraza") });
    const item = find(editor, "phrase");
    expect(item.disabled).toBe(false);
    expect(item.hint).toBe("/fraza");
    item.run!();
    expect(opened).toEqual([]);
    vi.runAllTimers();
    expect(opened).toEqual(["fraza"]);
    withdraw();
    expect(find(editor, "phrase").disabled).toBe(true);
    editor.destroy();
  });

  it("asks for a comment on the selected text only", () => {
    const editor = editorWith(true);
    expect(find(editor, "comment").disabled).toBe(true);
    editor.commands.setTextSelection({ from: 11, to: 15 });
    const asked = heard(ASK_COMMENT_EVENT);
    const panel = heard(OPEN_PANEL_EVENT);
    const comment = find(editor, "comment");
    expect(comment.disabled).toBe(false);
    comment.run!();
    expect(panel.got).toEqual(["comments"]);
    expect(asked.got).toEqual([""]);
    asked.stop(); panel.stop(); editor.destroy();
  });

  it("opens Pregled ispisa, also on a submitted work, and keeps Word, Tablica, Slika and Fraza off", () => {
    const editor = editorWith(false);
    const print = heard(PRINT_PREVIEW_EVENT);
    const item = find(editor, "print");
    expect(item.disabled).toBe(false);
    item.run!();
    expect(print.got).toHaveLength(1);
    expect(find(editor, "docx").disabled).toBe(true);
    print.stop(); editor.destroy();
    const writable = editorWith(true);
    for (const id of ["table", "image", "phrase"]) expect(find(writable, id).disabled).toBe(true);
    writable.destroy();
  });
});
