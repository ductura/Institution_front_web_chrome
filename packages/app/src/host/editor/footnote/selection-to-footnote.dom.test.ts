// @vitest-environment jsdom
// ED-95: Pretvori › Označeno u fusnotu, the prototype's toFn. Invented text.
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { footnotesOf } from "./footnote-model";
import { selectionToFootnote } from "./selection-to-footnote";

const ID = "00000000-0000-4000-8000-000000000001";
const ID2 = "00000000-0000-4000-8000-000000000002";
let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

function make(editable = true) {
  editor = new Editor({
    element: document.createElement("div"), extensions: createEditorExtensionsV3(), editable,
    content: { type: "doc", content: [
      { type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Prvi izmišljeni odlomak." }] },
      { type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID2 }, content: [{ type: "text", text: "Drugi odlomak." }] },
    ] },
  });
  return editor;
}

describe("Označeno u fusnotu (ED-95)", () => {
  it("moves the selected text into a footnote in its place", () => {
    const e = make();
    e.commands.setTextSelection({ from: 6, to: 16 });
    expect(selectionToFootnote(e, 3)).toBe("done");
    expect(e.state.doc.child(0).textContent).toBe("Prvi  odlomak.");
    expect(footnotesOf(e.state.doc).map((f) => f.text)).toEqual(["izmišljeni"]);
  });

  it("asks for text within one paragraph", () => {
    const e = make();
    e.commands.setTextSelection(4);
    expect(selectionToFootnote(e, 3)).toBe("needsText");
    e.commands.setTextSelection({ from: 6, to: 30 });
    expect(selectionToFootnote(e, 3)).toBe("needsText");
    expect(footnotesOf(e.state.doc)).toEqual([]);
  });

  it("does nothing where footnotes are not supported, or on a submitted work", () => {
    const e = make();
    e.commands.setTextSelection({ from: 6, to: 16 });
    expect(selectionToFootnote(e, 2)).toBe("failed");
    expect(e.state.doc.child(0).textContent).toBe("Prvi izmišljeni odlomak.");
    e.destroy();
    const locked = make(false);
    locked.commands.setTextSelection({ from: 6, to: 16 });
    expect(selectionToFootnote(locked, 3)).toBe("failed");
  });
});
