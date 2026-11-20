// @vitest-environment node
import { Editor, getSchema, type JSONContent } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";

import { FIXTURE_V4 } from "../document/document/fixture-v4";
import { canonicalToTiptapV4, tiptapToCanonicalV4 } from "./interop-v4";
import { codeBlockTab, tidyText, V4_CORE_EXTENSIONS, validBlockAtom } from "./extensions-v4";
import { createEditorExtensionsV4, V4_EXTENSION_NAMES } from "./schema";

/** Synthetic text and ids only. Contract document-schema-v4 §2 to §5 and §9. */
const schema = getSchema(createEditorExtensionsV4());
const PASTE = { type: "paste", attrs: { pasteId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sourceId: null } };

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function setUp(content: unknown[]): Editor {
  editor = new Editor({
    element: null,
    enableCoreExtensions: V4_CORE_EXTENSIONS,
    extensions: createEditorExtensionsV4(),
    content: { type: "doc", content } as JSONContent,
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}

const paragraph = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });
const valid = (json: unknown) => {
  try {
    schema.nodeFromJSON(json).check();
    return true;
  } catch {
    return false;
  }
};
const doc = (...content: unknown[]) => ({ type: "doc", content });
const typesOf = (e: Editor) => (e.getJSON().content ?? []).map((node) => node.type);
/** Cursor at `offset` inside the text of the block at `index` (top level, or in the first box). */
function caret(e: Editor, offset: number, index = 0): void {
  let pos = -1;
  let seen = 0;
  e.state.doc.descendants((node, at) => {
    if (pos === -1 && node.isTextblock && seen++ === index) pos = at + 1 + offset;
  });
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, pos)));
}

describe("v4 editor schema", () => {
  it("registers exactly the v4 extension names", () => {
    expect(createEditorExtensionsV4().map((extension) => extension.name).sort()).toEqual([...V4_EXTENSION_NAMES].sort());
  });

  it("holds the fixture and gives back the same JSON", () => {
    const json = canonicalToTiptapV4(FIXTURE_V4);
    expect(schema.nodeFromJSON(json).toJSON()).toEqual(json);
  });

  it("lets a box hold paragraphs only, never a box", () => {
    expect(valid(doc({ type: "box", attrs: { kind: "lemma" }, content: [paragraph("a"), paragraph("b")] }))).toBe(true);
    expect(valid(doc({ type: "box", attrs: { kind: "lemma" }, content: [] }))).toBe(false);
    expect(valid(doc({ type: "box", attrs: { kind: "lemma" }, content: [{ type: "heading", attrs: { level: 1 } }] }))).toBe(false);
    const inner = { type: "box", attrs: { kind: "lemma" }, content: [paragraph("a")] };
    expect(valid(doc({ type: "box", attrs: { kind: "lemma" }, content: [inner] }))).toBe(false);
    expect(valid(doc({ type: "box", attrs: { kind: "lemma" }, content: [{ type: "formula", attrs: { tex: "x" } }] }))).toBe(false);
  });

  it("keeps an inline formula out of a heading and formatting out of a code block", () => {
    expect(valid(doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "inlineFormula", attrs: { tex: "x" } }] }))).toBe(false);
    expect(valid(doc({ type: "paragraph", content: [{ type: "inlineFormula", attrs: { tex: "x" } }] }))).toBe(true);
    expect(valid(doc({ type: "codeBlock", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] }))).toBe(false);
    expect(valid(doc({ type: "codeBlock", content: [{ type: "text", text: "x", marks: [PASTE, { type: "imported" }] }] }))).toBe(true);
    expect(valid(doc({ type: "codeBlock", content: [{ type: "inlineFormula", attrs: { tex: "x" } }] }))).toBe(false);
    expect(schema.nodes.codeBlock!.spec.code).toBe(true);
  });

  it("makes sup and sub exclude each other", () => {
    const e = setUp([paragraph("x2", [{ type: "sub" }])]);
    e.commands.selectAll();
    e.commands.toggleSup();
    expect(e.getJSON().content![0]!.content![0]!.marks).toEqual([{ type: "sup" }]);
  });

  it("does not extend a link, a paste or an import run while typing at its end", () => {
    const e = setUp([paragraph("veza", [{ type: "link", attrs: { href: "https://primjer.invalid/" } }, PASTE, { type: "imported" }])]);
    caret(e, 4);
    e.view.dispatch(e.state.tr.insertText("x"));
    expect(e.getJSON().content![0]!.content![1]).toEqual({ type: "text", text: "x" });
  });
});

describe("v4 provenance marks (✓ B-7)", () => {
  it("refuses adding or removing paste and imported as marks", () => {
    const e = setUp([paragraph("zalijepljeno", [PASTE]), paragraph("napisano")]);
    const before = e.getJSON();
    e.commands.selectAll();
    expect(e.commands.unsetMark("paste")).toBe(true);
    e.commands.setMark("imported");
    e.commands.setMark("paste", { pasteId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" });
    expect(e.getJSON()).toEqual(before);
  });

  it("lets formatting change on pasted text and keeps its mark", () => {
    const e = setUp([paragraph("zalijepljeno", [PASTE])]);
    e.commands.selectAll();
    e.commands.toggleBold();
    expect(e.getJSON().content![0]!.content![0]!.marks).toEqual([{ type: "bold" }, PASTE]);
  });
});

describe("v4 commands", () => {
  it("makes a paragraph a code block without formatting and keeps the provenance mark", () => {
    const e = setUp([{ type: "paragraph", content: [{ type: "text", text: "print(1)", marks: [{ type: "bold" }, PASTE] }] }]);
    caret(e, 1);
    expect(e.commands.setCodeBlock("python")).toBe(true);
    expect(e.getJSON().content![0]).toMatchObject({ type: "codeBlock", attrs: { language: "python", caption: null }, content: [{ text: "print(1)", marks: [PASTE] }] });
    expect(e.commands.setCodeBlockCaption("  Ispis\nprimjera ")).toBe(true);
    expect(e.getJSON().content![0]!.attrs!.caption).toBe("Ispis primjera");
    expect(e.commands.setCodeBlockLanguage("cobol" as never)).toBe(false);
  });

  it("refuses a code block for a paragraph with an inline atom instead of dropping it", () => {
    const e = setUp([{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "inlineFormula", attrs: { tex: "x" } }] }]);
    caret(e, 0);
    e.commands.setCodeBlock();
    expect(typesOf(e)).toEqual(["paragraph"]);
  });

  it("writes four spaces for Tab in a code block only", () => {
    const e = setUp([{ type: "codeBlock", content: [{ type: "text", text: "x" }] }, paragraph("y")]);
    caret(e, 0);
    expect(codeBlockTab(e)).toBe(true);
    expect(e.state.doc.firstChild!.textContent).toBe("    x");
    caret(e, 0, 1);
    expect(codeBlockTab(e)).toBe(false);
  });

  it("wraps paragraphs in a box, changes its kind and lifts them out again", () => {
    const e = setUp([paragraph("a"), paragraph("b"), { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "c" }] }]);
    caret(e, 0);
    expect(e.commands.wrapBox("definition")).toBe(true);
    expect(typesOf(e)).toEqual(["box", "paragraph", "heading"]);
    expect(e.commands.wrapBox("example")).toBe(false);
    expect(e.commands.setBoxKind("example")).toBe(true);
    expect(e.getJSON().content![0]!.attrs!.kind).toBe("example");
    expect(e.commands.setBoxKind("teorem" as never)).toBe(false);
    expect(e.commands.unwrapBox()).toBe(true);
    expect(typesOf(e)).toEqual(["paragraph", "paragraph", "heading"]);
    caret(e, 0, 2);
    expect(e.commands.wrapBox("remark")).toBe(false);
  });

  it("inserts tidy atom blocks and refuses an empty formula", () => {
    const e = setUp([paragraph("a")]);
    caret(e, 1);
    expect(e.commands.insertFormula("  \n ")).toBe(false);
    expect(e.commands.insertFormula(" x +\ny ")).toBe(true);
    expect(e.commands.insertTable({ rows: [["Grad\nA", "Udio"], ["", "1 %"]], title: " " })).toBe(true);
    expect(e.commands.insertTable({ rows: [] })).toBe(false);
    expect(e.commands.insertImage({ widthPercent: 19 })).toBe(false);
    expect(e.commands.insertImage({ widthPercent: 50, title: "Izmišljena slika" })).toBe(true);
    expect(e.commands.insertPageBreak()).toBe(true);
    const result = tiptapToCanonicalV4(e.getJSON());
    expect(result.ok).toBe(true);
    const nodes = result.ok ? result.doc.nodes : [];
    expect(nodes.find((node) => node.type === "formula")).toMatchObject({ tex: "x + y" });
    expect(nodes.find((node) => node.type === "table")).toEqual(expect.objectContaining({ rows: [["Grad A", "Udio"], ["", "1 %"]], header: true }));
    expect(nodes.find((node) => node.type === "table")).not.toHaveProperty("title");
    expect(nodes.filter((node) => node.type === "pageBreak")).toHaveLength(1);
  });

  it("puts an inline formula into a paragraph, never into a heading", () => {
    const e = setUp([{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "N" }] }, paragraph("a")]);
    caret(e, 1);
    expect(e.commands.insertInlineFormula("x^{2}")).toBe(false);
    caret(e, 1, 1);
    expect(e.commands.insertInlineFormula(" ")).toBe(false);
    expect(e.commands.insertInlineFormula("x^{2}")).toBe(true);
    e.commands.selectAll();
    e.commands.setHighlight("#f2d24b");
    const formula = e.getJSON().content![1]!.content![1]!;
    expect(formula).toEqual({ type: "inlineFormula", attrs: { tex: "x^{2}" } });
  });

  it("keeps marks off an inline formula in a box paragraph", () => {
    const formula = { type: "inlineFormula", attrs: { tex: "x" } };
    const e = setUp([{ type: "box", attrs: { kind: "example" }, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, formula] }] }]);
    e.commands.selectAll();
    e.commands.toggleBold();
    expect(e.state.doc.firstChild!.firstChild!.toJSON().content).toEqual([{ type: "text", text: "a", marks: [{ type: "bold" }] }, formula]);
  });

  it("sets valid attribute marks and refuses invalid ones", () => {
    const e = setUp([paragraph("tekst")]);
    e.commands.selectAll();
    expect(e.commands.setHighlight("#F2D24B")).toBe(false);
    expect(e.commands.setLang("hr-HR")).toBe(false);
    expect(e.commands.setLink("javascript:alert(1)")).toBe(false);
    expect(e.commands.setHighlight("#7fc97f")).toBe(true);
    expect(e.commands.setLang("und")).toBe(true);
    expect(e.commands.setLink("https://primjer.invalid/a")).toBe(true);
    const result = tiptapToCanonicalV4(e.getJSON());
    expect(result.ok && result.doc.nodes[0]).toMatchObject({
      children: [{ marks: [{ color: "#7fc97f", type: "highlight" }, { lang: "und", type: "lang" }, { href: "https://primjer.invalid/a", type: "link" }] }],
    });
  });

  it("sets and clears a variant group on a paragraph", () => {
    const e = setUp([paragraph("a")]);
    caret(e, 0);
    expect(e.commands.setVariantGroup("DDDDDDDD-dddd-4ddd-8ddd-dddddddddddd")).toBe(false);
    expect(e.commands.setVariantGroup("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBe(true);
    expect(e.getJSON().content![0]!.attrs!.variantGroup).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(e.commands.setVariantGroup(null)).toBe(true);
    expect(e.getJSON().content![0]!.attrs!.variantGroup).toBeNull();
  });

  it("changes an atom's fields as a node of the same type and id (§9.3)", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-0000000000f1";
    const e = setUp([{ type: "formula", attrs: { nodeId: id, tex: "a" } }, paragraph("b")]);
    e.view.dispatch(e.state.tr.setSelection(NodeSelection.create(e.state.doc, 0)));
    expect(e.commands.updateBlockAtom({ tex: "" })).toBe(false);
    expect(e.commands.updateBlockAtom({ tex: "a + b" })).toBe(true);
    expect(e.state.doc.firstChild!.attrs).toMatchObject({ tex: "a + b", nodeId: id });
  });

  it("validates atom fields with the document validator", () => {
    expect(validBlockAtom("formula", { tex: "x" })).toMatchObject({ type: "formula", tex: "x" });
    expect(validBlockAtom("pageBreak", { extra: 1 })).toBeNull();
    expect(tidyText(" a\r\nb\n")).toBe("a b");
  });
});
