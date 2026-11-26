// @vitest-environment node
import { Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { createEditorExtensions, createEditorExtensionsV4 } from "../editor/schema";

import { DashEllipsis, dashOrEllipsis, ELLIPSIS, EN_DASH } from "./dash-ellipsis";

/** ED-48 (P2-24): the en dash and the ellipsis while typing. Invented text only. */

describe("dashOrEllipsis", () => {
  it.each([
    ["crno - ", { length: 2, text: `${EN_DASH} ` }],
    ["od 1990 - ", { length: 2, text: `${EN_DASH} ` }],
    ["i tako...", { length: 3, text: ELLIPSIS }],
  ])("%j is changed", (typed, swap) => {
    expect(dashOrEllipsis(typed)).toEqual(swap);
  });

  it.each(["crno-", "crno-bijeli ", "- ", "a -", "dva..", "x. . ."])("%j stays as typed", (typed) => {
    expect(dashOrEllipsis(typed)).toBeNull();
  });
});

function setup(content: JSONContent, v4 = false) {
  const editor = new Editor({ element: null, extensions: [...(v4 ? createEditorExtensionsV4() : createEditorExtensions()), DashEllipsis], content });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  const view = editor.view;
  const textInput = editor.state.plugins.map((p) => (p.props as { handleTextInput?: unknown }).handleTextInput)
    .filter((f): f is (...a: unknown[]) => boolean => typeof f === "function");
  return {
    text: () => editor.state.doc.textContent,
    select: (pos: number) => view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos))),
    type(chars: string) {
      for (const char of chars) {
        const { from, to } = editor.state.selection;
        if (!textInput.some((f) => f(view, from, to, char, () => editor.state.tr.insertText(char, from, to)))) {
          view.dispatch(editor.state.tr.insertText(char, from, to));
        }
      }
    },
  };
}

const paragraph = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] });

describe("DashEllipsis in the editor", () => {
  it("a spaced hyphen becomes an en dash and three stops an ellipsis", () => {
    const t = setup(paragraph(""));
    t.select(1);
    t.type("Razdoblje 1990 - 2000 i tako... crno-bijeli.");
    expect(t.text()).toBe(`Razdoblje 1990 ${EN_DASH} 2000 i tako${ELLIPSIS} crno-bijeli.`);
  });

  it("in a code block everything stays as typed", () => {
    const t = setup({ type: "doc", content: [{ type: "codeBlock", content: [{ type: "text", text: "x" }] }] }, true);
    t.select(2);
    t.type(" - y...");
    expect(t.text()).toBe("x - y...");
  });
});
