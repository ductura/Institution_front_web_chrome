// @vitest-environment node
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { createEditorExtensions, NODE_ID_ATTRIBUTE } from "../editor/schema";

import { moveSentenceInEditor, planSentenceMove, sentenceSpans, SentenceMove } from "./index";

/** ED-33 (P2-2): Alt+↑/↓ swaps a sentence with its neighbour inside the paragraph. Invented text only. */

const ID = "00000000-0000-4000-8000-000000000001";

function editorWith(text: string, editable = true): Editor {
  return new Editor({
    element: null,
    editable,
    extensions: [...createEditorExtensions(), SentenceMove],
    content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text }] }] },
  });
}

/** Puts the cursor `offset` characters into the first paragraph. */
function cursorAt(editor: Editor, offset: number): void {
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1 + offset)));
}

const text = (editor: Editor) => editor.state.doc.firstChild!.textContent;

describe("sentenceSpans", () => {
  it("cuts after the end marks and closing quotes, without the spaces around", () => {
    const t = "Park je velik. Ima „klupe.” Zar ne?";
    expect(sentenceSpans(t).map((s) => t.slice(s.from, s.to))).toEqual(["Park je velik.", "Ima „klupe.”", "Zar ne?"]);
  });
  it("keeps a last sentence without an end mark", () => {
    const t = "Prva rečenica. Druga bez točke";
    expect(sentenceSpans(t).map((s) => t.slice(s.from, s.to))).toEqual(["Prva rečenica.", "Druga bez točke"]);
  });
  it("gives nothing for blank text", () => {
    expect(sentenceSpans("   ")).toEqual([]);
  });
});

describe("planSentenceMove", () => {
  const t = "Prva. Druga. Treća.";
  it("swaps with the sentence before or after", () => {
    expect(planSentenceMove(t, 8, "up")).toEqual({ ok: true, first: { from: 0, to: 5 }, second: { from: 6, to: 12 }, moving: "second" });
    expect(planSentenceMove(t, 8, "down")).toEqual({ ok: true, first: { from: 6, to: 12 }, second: { from: 13, to: 19 }, moving: "first" });
  });
  it("refuses at the edges and in a paragraph of one sentence", () => {
    expect(planSentenceMove(t, 1, "up")).toEqual({ ok: false, reason: "first" });
    expect(planSentenceMove(t, 15, "down")).toEqual({ ok: false, reason: "last" });
    expect(planSentenceMove("Samo jedna.", 2, "down")).toEqual({ ok: false, reason: "one-sentence" });
  });
});

describe("moveSentenceInEditor", () => {
  it("moves the sentence up and keeps the cursor at its start", () => {
    const editor = editorWith("Prva. Druga. Treća.");
    cursorAt(editor, 8);
    expect(moveSentenceInEditor(editor, "up")).toBe(true);
    expect(text(editor)).toBe("Druga. Prva. Treća.");
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.doc.firstChild!.attrs[NODE_ID_ATTRIBUTE]).toBe(ID);
    editor.destroy();
  });
  it("moves the sentence down twice and stops at the end", () => {
    const editor = editorWith("Prva. Druga. Treća.");
    cursorAt(editor, 2);
    expect(moveSentenceInEditor(editor, "down")).toBe(true);
    expect(text(editor)).toBe("Druga. Prva. Treća.");
    expect(moveSentenceInEditor(editor, "down")).toBe(true);
    expect(text(editor)).toBe("Druga. Treća. Prva.");
    expect(moveSentenceInEditor(editor, "down")).toBe(false);
    expect(text(editor)).toBe("Druga. Treća. Prva.");
    editor.destroy();
  });
  it("does nothing in a read-only work or with a selection", () => {
    const locked = editorWith("Prva. Druga.", false);
    cursorAt(locked, 8);
    expect(moveSentenceInEditor(locked, "up")).toBe(false);
    locked.destroy();
    const editor = editorWith("Prva. Druga.");
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 7, 10)));
    expect(moveSentenceInEditor(editor, "up")).toBe(false);
    expect(text(editor)).toBe("Prva. Druga.");
    editor.destroy();
  });
});
