// @vitest-environment node
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensions } from "../editor/schema";

import { DashEllipsis } from "./dash-ellipsis";
import {
  resetTypingTypographyForTest, setTypingTypography, subscribeTypingTypography, TYPING_TYPOGRAPHY_KEY, typingTypographyOn,
} from "./typing-switch";

/**
 * ED-99: "Tipografija dok tipkam" switches the dash and the ellipsis here; the
 * quotes are switched in croatian-quotes.test.ts, which drives keydown and
 * beforeinput as their rule needs. Invented text only.
 */

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, data };
}

function typed(chars: string): string {
  const editor = new Editor({ element: null, extensions: [...createEditorExtensions(), DashEllipsis],
    content: { type: "doc", content: [{ type: "paragraph" }] } });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  const view = editor.view;
  view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)));
  const textInput = editor.state.plugins.map((p) => (p.props as { handleTextInput?: unknown }).handleTextInput)
    .filter((f): f is (...a: unknown[]) => boolean => typeof f === "function");
  for (const char of chars) {
    const { from, to } = editor.state.selection;
    if (!textInput.some((f) => f(view, from, to, char, () => editor.state.tr.insertText(char, from, to)))) {
      view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  }
  const text = editor.state.doc.textContent;
  editor.destroy();
  return text;
}

afterEach(() => resetTypingTypographyForTest());

describe("Tipografija dok tipkam", () => {
  it("is on until switched off, and changes the typed marks", () => {
    expect(typingTypographyOn(() => memory())).toBe(true);
    expect(typed("Riva - more...")).toBe("Riva – more…");
  });

  it("switched off, leaves every typed character as it is", () => {
    const store = memory();
    setTypingTypography(false, () => store);
    expect(store.data.get(TYPING_TYPOGRAPHY_KEY)).toBe("off");
    expect(typed("Riva - more...")).toBe("Riva - more...");
  });

  it("reads the kept choice and tells its listeners of a change", () => {
    const store = memory();
    store.setItem(TYPING_TYPOGRAPHY_KEY, "off");
    expect(typingTypographyOn(() => store)).toBe(false);
    let heard = 0;
    const stop = subscribeTypingTypography(() => { heard += 1; });
    expect(setTypingTypography(true, () => store)).toBe(true);
    stop();
    setTypingTypography(false, () => store);
    expect(heard).toBe(1);
    expect(typingTypographyOn()).toBe(false);
  });

  it("holds on this page when storage is blocked", () => {
    const blocked = () => { throw new Error("blocked"); };
    expect(typingTypographyOn(blocked)).toBe(true);
    setTypingTypography(false, blocked);
    expect(typingTypographyOn(blocked)).toBe(false);
  });
});
