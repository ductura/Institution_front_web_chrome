// @vitest-environment jsdom
// ED-129: Rečenica gore and Rečenica dolje from the toolbar menu (prototype sentUp, sentDown). Invented text.
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { moveSentenceFromMenu, sentenceMenuHr } from "./sentence-menu";

const ID = "00000000-0000-4000-8000-000000000001";
const ID2 = "00000000-0000-4000-8000-000000000002";
let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

function make(editable = true) {
  editor = new Editor({
    element: document.createElement("div"), extensions: createEditorExtensionsV3(), editable,
    content: { type: "doc", content: [
      { type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Prva rečenica. Druga rečenica." }] },
      { type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID2 }, content: [{ type: "text", text: "Samo jedna." }] },
    ] },
  });
  return editor;
}
const first = () => editor!.state.doc.child(0).textContent;

describe("Rečenica gore i dolje iz izbornika (ED-129)", () => {
  it("moves the sentence with the cursor up, and keeps the paragraph's id", () => {
    const e = make();
    e.commands.setTextSelection(20);
    expect(moveSentenceFromMenu(e, "up")).toBe("done");
    expect(first()).toBe("Druga rečenica. Prva rečenica.");
    expect(e.state.doc.child(0).attrs[NODE_ID_ATTRIBUTE]).toBe(ID);
  });
  it("moves it down", () => {
    const e = make();
    e.commands.setTextSelection(3);
    expect(moveSentenceFromMenu(e, "down")).toBe("done");
    expect(first()).toBe("Druga rečenica. Prva rečenica.");
  });
  it("names why nothing moved, with the prototype's words", () => {
    const e = make();
    e.commands.setTextSelection(3);
    expect(moveSentenceFromMenu(e, "up")).toBe("first");
    e.commands.setTextSelection(20);
    expect(moveSentenceFromMenu(e, "down")).toBe("last");
    e.commands.setTextSelection(36);
    expect(moveSentenceFromMenu(e, "down")).toBe("one-sentence");
    e.commands.setTextSelection({ from: 2, to: 6 });
    expect(moveSentenceFromMenu(e, "down")).toBe("notParagraph");
    expect(first()).toBe("Prva rečenica. Druga rečenica.");
    expect(sentenceMenuHr.first).toBe("Rečenica je već prva u odlomku.");
    expect(sentenceMenuHr["one-sentence"]).toBe("U odlomku je samo jedna rečenica.");
  });
  it("does nothing on a work that cannot be edited", () => {
    const e = make(false);
    e.commands.setTextSelection(20);
    expect(moveSentenceFromMenu(e, "up")).toBe("readOnly");
    expect(moveSentenceFromMenu(null, "up")).toBe("notParagraph");
  });
});
