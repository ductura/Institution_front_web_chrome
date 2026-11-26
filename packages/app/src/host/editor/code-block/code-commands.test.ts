// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { FIXTURE_V4, nid } from "../../../../../editor-core/src/document/document/fixture-v4";
import { validateDocumentV4 } from "../../../../../editor-core/src/document/document/validate-v4";
import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV3, createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { codeBlockPos, currentCodeBlockProps, insertCodeBlock, tidyCaption, updateCodeBlock, validCodeBlockProps } from "./code-commands.ts";
import { codeBlockAvailability, highlightDecorations, supportsCodeBlocks } from "./code-view.ts";
import { setHighlightEngine } from "./highlight.ts";

const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
Range.prototype.getClientRects = rects as never;
Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
Element.prototype.getClientRects = rects as never;

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; setHighlightEngine(null); });

const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "const a = 1;" }] }] } as JSONContent;
const v4 = (doc: JSONContent = content) => {
  editor = new Editor({ element: document.createElement("div"), enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content: doc });
  editor.commands.setTextSelection(3);
  return editor;
};
const blocks = (e: Editor) => (e.getJSON().content ?? []).filter((n) => n.type === "codeBlock");

describe("insertCodeBlock / updateCodeBlock", () => {
  it("turns the paragraph into a v4 code block with language and caption, text unchanged", () => {
    const e = v4();
    expect(insertCodeBlock(e, { language: "javascript", caption: "  Zbroj\nbrojeva " })).toBe(true);
    expect(blocks(e)).toEqual([{ type: "codeBlock", attrs: expect.objectContaining({ language: "javascript", caption: "Zbroj brojeva" }), content: [{ type: "text", text: "const a = 1;" }] }]);
  });
  it("refuses a language outside the list and a caption over 300 code points, document untouched", () => {
    const e = v4();
    const before = JSON.stringify(e.getJSON());
    expect(insertCodeBlock(e, { language: "bash" as never, caption: null })).toBe(false);
    expect(insertCodeBlock(e, { language: "c", caption: "x".repeat(301) })).toBe(false);
    expect(JSON.stringify(e.getJSON())).toBe(before);
    expect(insertCodeBlock(e, { language: "c", caption: "x".repeat(300) })).toBe(true);
  });
  it("counts the caption in code points", () => {
    expect(validCodeBlockProps({ language: null, caption: "😀".repeat(300) })).toBe(true);
    expect(validCodeBlockProps({ language: null, caption: "😀".repeat(301) })).toBe(false);
  });
  it("changes language and caption in place and keeps the code text", () => {
    const e = v4();
    insertCodeBlock(e, { language: "c", caption: null });
    e.commands.insertContentAt(0, { type: "paragraph", content: [{ type: "text", text: "Odlomak." }] });
    e.commands.setTextSelection(e.state.doc.content.size - 2);
    const pos = codeBlockPos(e)!;
    expect(currentCodeBlockProps(e)).toEqual({ language: "c", caption: null });
    expect(updateCodeBlock(e, pos, { language: "python", caption: "Naslov" })).toBe(true);
    expect(blocks(e)[0]).toMatchObject({ attrs: { language: "python", caption: "Naslov" }, content: [{ text: "const a = 1;" }] });
    expect(updateCodeBlock(e, pos, { language: "nope" as never, caption: null })).toBe(false);
    expect(updateCodeBlock(e, 9999, { language: "c", caption: null })).toBe(false);
    expect(updateCodeBlock(e, 0, { language: "c", caption: null })).toBe(false); // ne pokazuje na blok koda
  });
  it("refuses on a v3 schema and in a read-only editor", () => {
    editor = new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV3(), content });
    expect(insertCodeBlock(editor, { language: "c", caption: null })).toBe(false);
    editor.destroy();
    const e = v4();
    e.setEditable(false);
    expect(insertCodeBlock(e, { language: "c", caption: null })).toBe(false);
  });
  it("tidies captions", () => {
    expect(tidyCaption("   ")).toBeNull();
    expect(tidyCaption(null)).toBeNull();
  });
});

describe("the schema keeps code text-only", () => {
  it("allows only paste/imported marks in a code block", () => {
    const e = v4();
    const node = e.schema.nodes.codeBlock!;
    expect(node.allowsMarkType(e.schema.marks.paste!)).toBe(true);
    expect(node.allowsMarkType(e.schema.marks.imported!)).toBe(true);
    expect(node.allowsMarkType(e.schema.marks.bold!)).toBe(false);
  });
  it("the canonical v4 validator refuses a language outside the list and a bold mark in code", () => {
    const doc = (block: Record<string, unknown>) => ({ ...structuredClone(FIXTURE_V4), nodes: [block] });
    const base = { type: "codeBlock", id: nid("aaaaaaaa-aaaa-4aaa-8aaa-000000000001"), children: [{ type: "text", text: "int x;", marks: [] }], language: "c" };
    expect(validateDocumentV4(doc(base)).ok).toBe(true);
    expect(validateDocumentV4(doc({ ...base, language: "bash" })).ok).toBe(false);
    expect(validateDocumentV4(doc({ ...base, children: [{ type: "text", text: "int x;", marks: ["bold"] }] })).ok).toBe(false);
    expect(validateDocumentV4(doc({ ...base, children: [{ type: "text", text: "int x;", marks: ["imported"] }] })).ok).toBe(true);
  });
});

describe("view", () => {
  it("is offered only for a v4 work that can be edited", () => {
    const e = v4();
    expect(supportsCodeBlocks(e.schema, 4)).toBe(true);
    expect(supportsCodeBlocks(e.schema, 3)).toBe(false);
    expect(codeBlockAvailability(e.schema, 4, true).enabled).toBe(true);
    expect(codeBlockAvailability(e.schema, 3, true)).toMatchObject({ enabled: false });
    expect(codeBlockAvailability(e.schema, 4, false)).toMatchObject({ enabled: false });
  });
  it("colouring decorates the text but never changes the document", () => {
    const e = v4({ type: "doc", content: [{ type: "codeBlock", attrs: { language: "javascript", caption: null }, content: [{ type: "text", text: "const a = 1;" }] }] });
    const before = JSON.stringify(e.getJSON());
    const set = highlightDecorations(e.state.doc);
    expect(set.find().length).toBeGreaterThan(0);
    expect(JSON.stringify(e.getJSON())).toBe(before);
  });
  it("without the library the block is still there, undecorated", () => {
    setHighlightEngine(() => { throw new Error("nedostupno"); });
    const e = v4({ type: "doc", content: [{ type: "codeBlock", attrs: { language: "javascript", caption: null }, content: [{ type: "text", text: "let x;" }] }] });
    expect(highlightDecorations(e.state.doc).find()).toEqual([]);
    expect(blocks(e)).toHaveLength(1);
  });
});
