// @vitest-environment jsdom
// WEB-V21-STEM-FORMULA-UREDNIK: inserting and changing formula nodes gives the exact v4 node.
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { insertFormula, tidyTex, updateFormula } from "./formula-commands";

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

function setUp(): Editor {
  editor = new Editor({
    element: document.createElement("div"), enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(),
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljeni odlomak." }] }] } as JSONContent,
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  editor.commands.setTextSelection(5);
  return editor;
}
const nodes = (e: Editor, type: string) => {
  const out: { pos: number; tex: string }[] = [];
  e.state.doc.descendants((n, pos) => { if (n.type.name === type) out.push({ pos, tex: String(n.attrs.tex) }); });
  return out;
};

describe("insertFormula", () => {
  it("inserts a block formula with the exact tex", () => {
    const e = setUp();
    expect(insertFormula(e, "block", "\\frac{a}{b}")).toBe(true);
    expect(nodes(e, "formula").map((n) => n.tex)).toEqual(["\\frac{a}{b}"]);
    expect(() => e.state.doc.check()).not.toThrow();
  });
  it("inserts an inline formula inside the sentence", () => {
    const e = setUp();
    expect(insertFormula(e, "inline", "x^2")).toBe(true);
    expect(nodes(e, "inlineFormula").map((n) => n.tex)).toEqual(["x^2"]);
    expect(e.state.doc.firstChild?.type.name).toBe("paragraph");
  });
  it("tidies a line break to a space", () => {
    const e = setUp();
    insertFormula(e, "inline", " a\nb ");
    expect(nodes(e, "inlineFormula")[0]?.tex).toBe("a b");
    expect(tidyTex("\r\nx\r\n")).toBe("x");
  });
  it("refuses empty input and input over the limit, leaving the document as it was", () => {
    const e = setUp();
    const before = JSON.stringify(e.getJSON());
    expect(insertFormula(e, "block", "   ")).toBe(false);
    expect(insertFormula(e, "block", "x".repeat(4001))).toBe(false);
    expect(insertFormula(e, "inline", "x".repeat(1001))).toBe(false);
    expect(JSON.stringify(e.getJSON())).toBe(before);
    expect(insertFormula(e, "inline", "x".repeat(1000))).toBe(true);
  });
  it("refuses a % comment followed by a line break instead of silently commenting out the rest", () => {
    const e = setUp();
    const before = JSON.stringify(e.getJSON());
    expect(insertFormula(e, "inline", "x % note\n+y")).toBe(false);
    expect(JSON.stringify(e.getJSON())).toBe(before);
    expect(insertFormula(e, "inline", "x \\% note\n+y")).toBe(true);
    expect(insertFormula(e, "inline", "x % trailing comment only")).toBe(true);
  });
  it("counts code points, not UTF-16 units", () => {
    const e = setUp();
    expect(insertFormula(e, "inline", "😀".repeat(1000))).toBe(true);
  });
  it("is refused in a read-only editor and in a schema without the node", () => {
    const e = setUp();
    e.setEditable(false);
    expect(insertFormula(e, "block", "x")).toBe(false);
    expect(insertFormula(null, "block", "x")).toBe(false);
  });
});

describe("updateFormula", () => {
  it("changes a formula in place and refuses a bad one", () => {
    const e = setUp();
    insertFormula(e, "inline", "a");
    const { pos } = nodes(e, "inlineFormula")[0]!;
    expect(updateFormula(e, pos, "inline", "b+c")).toBe(true);
    expect(nodes(e, "inlineFormula").map((n) => n.tex)).toEqual(["b+c"]);
    expect(updateFormula(e, pos, "inline", "y".repeat(1001))).toBe(false);
    expect(updateFormula(e, pos, "inline", "")).toBe(false);
    expect(nodes(e, "inlineFormula").map((n) => n.tex)).toEqual(["b+c"]);
  });
  it("changes a block formula", () => {
    const e = setUp();
    insertFormula(e, "block", "a");
    const { pos } = nodes(e, "formula")[0]!;
    expect(updateFormula(e, pos, "block", "\\sqrt{2}")).toBe(true);
    expect(nodes(e, "formula")[0]?.tex).toBe("\\sqrt{2}");
    expect(updateFormula(e, pos, "inline", "z")).toBe(false);
  });
  it("refuses a position that holds no formula", () => {
    const e = setUp();
    expect(updateFormula(e, 0, "block", "x")).toBe(false);
    expect(updateFormula(e, 9999, "block", "x")).toBe(false);
  });
});
