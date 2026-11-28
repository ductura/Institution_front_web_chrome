// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";
import { OPEN_PANEL_EVENT } from "@/components/editor/layout-prefs/open-panel";

import { ASK_COMMENT_EVENT, takeAskedComment } from "../comments/ask-comment";
import { commentKey, listenCommentKey } from "./comment-key";

// ED-93: Ctrl/Cmd+Alt+M on the text starts a comment on the selection. Invented text.
function editorOf() {
  return new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV2(), content: {
    type: "doc", content: [
      { type: "paragraph", attrs: { nodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, content: [{ type: "text", text: "Izmišljen tekst o mostovima." }] },
    ] } });
}
const press = (over: Partial<KeyboardEventInit>) => new KeyboardEvent("keydown", { key: "m", altKey: true, cancelable: true, ...over });
function heard(name: string) {
  const got: unknown[] = [];
  const on = (event: Event) => { got.push((event as CustomEvent<unknown>).detail); };
  document.addEventListener(name, on);
  return { got, stop: () => document.removeEventListener(name, on) };
}

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; takeAskedComment(); });

describe("Ctrl+Alt+M comment key (ED-93)", () => {
  it("opens Komentari and asks for a comment on the selected text", () => {
    editor = editorOf();
    editor.commands.setTextSelection({ from: 11, to: 15 });
    const panel = heard(OPEN_PANEL_EVENT);
    const asked = heard(ASK_COMMENT_EVENT);
    const said: string[] = [];
    const stop = listenCommentKey(editor, () => said.push("oznaka"));
    const event = press({ ctrlKey: true });
    editor.view.dom.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(panel.got).toEqual(["comments"]);
    expect(asked.got).toEqual([""]);
    expect(said).toEqual([]);
    stop(); panel.stop(); asked.stop();
  });

  it("only says to select text when nothing is selected", () => {
    editor = editorOf();
    const panel = heard(OPEN_PANEL_EVENT);
    const said: string[] = [];
    expect(commentKey(editor, press({ ctrlKey: true }), () => said.push("oznaka"), document, false)).toBe(true);
    expect(said).toEqual(["oznaka"]);
    expect(panel.got).toEqual([]);
    panel.stop();
  });

  it("takes Cmd on a Mac and leaves other keys and a stopped listener alone", () => {
    editor = editorOf();
    editor.commands.setTextSelection({ from: 11, to: 15 });
    const panel = heard(OPEN_PANEL_EVENT);
    expect(commentKey(editor, press({ metaKey: true }), () => {}, document, true)).toBe(true);
    expect(commentKey(editor, press({ metaKey: true }), () => {}, document, false)).toBe(false);
    expect(commentKey(editor, press({ ctrlKey: true, shiftKey: true }), () => {}, document, false)).toBe(false);
    expect(commentKey(editor, press({ ctrlKey: true, key: "n" }), () => {}, document, false)).toBe(false);
    const stop = listenCommentKey(editor, () => {});
    stop();
    editor.view.dom.dispatchEvent(press({ ctrlKey: true }));
    expect(panel.got).toEqual(["comments"]);
    panel.stop();
  });
});
