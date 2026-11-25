// @vitest-environment jsdom
// WEB-V21-STEM-FORMULA-UREDNIK: availability of "Formula…", the KaTeX drawing of the atoms and the double click.
import { Editor, getSchema, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV3, createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { formulaAt, formulaAvailability, formulaViewPlugin, supportsFormulas, type FormulaTarget } from "./formula-view";
import { formulaHostHr } from "./messages.hr";

const v4 = getSchema(createEditorExtensionsV4());
const v3 = getSchema(createEditorExtensionsV3());
let editor: Editor | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { editor?.destroy(); host?.remove(); editor = null; host = null; });

describe("formulaAvailability", () => {
  it("is on for schema v4 with the formula tool in an editable work", () => {
    expect(formulaAvailability(v4, 4, ["formula"], true)).toEqual({ enabled: true });
  });
  it("is off with a reason on schema 3, or when the version is not confirmed", () => {
    expect(formulaAvailability(v3, 3, ["formula"], true)).toEqual({ enabled: false, reason: formulaHostHr.disabledSchema });
    expect(formulaAvailability(v4, undefined, ["formula"], true)).toEqual({ enabled: false, reason: formulaHostHr.disabledSchema });
    expect(formulaAvailability(v4, 3, ["formula"], true).enabled).toBe(false);
    expect(supportsFormulas(v3, 4)).toBe(false);
  });
  it("is off with a reason when the field has no formula tool", () => {
    expect(formulaAvailability(v4, 4, [], true)).toEqual({ enabled: false, reason: formulaHostHr.disabledTool });
    expect(formulaAvailability(v4, 4, ["code", "chem"], true).enabled).toBe(false);
  });
  it("is off when the work cannot be edited", () => {
    expect(formulaAvailability(v4, 4, ["formula"], false)).toEqual({ enabled: false, reason: formulaHostHr.disabledReadOnly });
  });
});

function setUp(canEdit = true): { opened: FormulaTarget[] } {
  const opened: FormulaTarget[] = [];
  host = document.createElement("div");
  document.body.append(host);
  editor = new Editor({
    element: host, enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(),
    content: { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Prije " }, { type: "inlineFormula", attrs: { tex: "x^2" } }] },
      { type: "formula", attrs: { tex: "\\href{http://example.invalid}{x}" } },
      { type: "formula", attrs: { tex: "\\frac{1}{2}" } },
    ] } as JSONContent,
  });
  editor.registerPlugin(formulaViewPlugin((t) => opened.push(t), () => canEdit));
  return { opened };
}

describe("formulaViewPlugin", () => {
  it("draws formulas with KaTeX and an untrusted one as its source", () => {
    setUp();
    expect(host!.querySelectorAll(".katex").length).toBe(3);
    expect(host!.querySelector("[data-formula] a")).toBeNull();
    expect(host!.textContent).toContain("\\href{http://example.invalid}{x}");
  });
  it("opens the dialog on a double click of a formula, with its position and text", () => {
    const { opened } = setUp();
    const inlinePos = 7;
    const node = editor!.state.doc.nodeAt(inlinePos)!;
    expect(node.type.name).toBe("inlineFormula");
    const handled = editor!.view.someProp("handleDoubleClickOn", (f) => f(editor!.view, inlinePos, node, inlinePos, {} as never, true));
    expect(handled).toBe(true);
    expect(opened).toEqual([{ pos: inlinePos, kind: "inline", tex: "x^2" }]);
  });
  it("does nothing on a double click when the work cannot be edited", () => {
    const { opened } = setUp(false);
    const node = editor!.state.doc.nodeAt(7)!;
    editor!.view.someProp("handleDoubleClickOn", (f) => f(editor!.view, 7, node, 7, {} as never, true));
    expect(opened).toEqual([]);
  });
  it("formulaAt finds only formula nodes", () => {
    setUp();
    expect(formulaAt(editor!.state.doc, 7)?.kind).toBe("inline");
    expect(formulaAt(editor!.state.doc, 0)).toBeNull();
    expect(formulaAt(editor!.state.doc, -1)).toBeNull();
    expect(formulaAt(editor!.state.doc, 99999)).toBeNull();
  });
});
