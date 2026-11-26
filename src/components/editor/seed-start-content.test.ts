// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createEditorExtensions } from "@/editor";

import { seedStartContent } from "./LocalDocument";

/** F4-V17-R01: the template skeleton goes into an empty, writable sheet once. Invented text only. */

const blocks = [
  { type: "paragraph", content: [{ type: "text", text: "Naslov: " }] },
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Uvod" }] },
  { type: "paragraph", content: [{ type: "text", text: "Predstavite temu." }] },
];

function sheet(editable = true, content?: object) {
  const editor = new Editor({ element: null, extensions: createEditorExtensions(""), editable, content: content ?? { type: "doc", content: [{ type: "paragraph" }] } });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}
const texts = (e: Editor) => { const out: string[] = []; e.state.doc.forEach((n) => out.push(`${n.type.name}:${n.textContent}`)); return out; };

describe("seedStartContent", () => {
  it("puts the skeleton into an empty, writable sheet", () => {
    const editor = sheet();
    expect(seedStartContent(editor, blocks)).toBe(true);
    expect(texts(editor)).toEqual(["paragraph:Naslov: ", "heading:Uvod", "paragraph:Predstavite temu."]);
  });
  it("never overwrites text the author already typed", () => {
    const editor = sheet(true, { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Moj tekst" }] }] });
    expect(seedStartContent(editor, blocks)).toBe(false);
    expect(texts(editor)).toEqual(["paragraph:Moj tekst"]);
  });
  it("does nothing in a read-only sheet (submitted, closed or signed out)", () => {
    const editor = sheet(false);
    expect(seedStartContent(editor, blocks)).toBe(false);
    expect(editor.isEmpty).toBe(true);
  });
  it.each([[null], [undefined], [[]]])("does nothing without blocks (%j)", (none) => {
    const editor = sheet();
    expect(seedStartContent(editor, none as never)).toBe(false);
    expect(editor.isEmpty).toBe(true);
  });
  it("is once: a second call finds the sheet no longer empty", () => {
    const editor = sheet();
    seedStartContent(editor, blocks);
    expect(seedStartContent(editor, blocks)).toBe(false);
    expect(texts(editor)).toHaveLength(3);
  });
});
