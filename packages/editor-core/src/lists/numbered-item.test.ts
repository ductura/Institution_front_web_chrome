// @vitest-environment node
import { Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";

import { DOCUMENT_SCHEMA_VERSION_V4, validateDocumentV4 } from "../document/document";
import { canonicalToTiptapV4, tiptapToCanonicalV4 } from "../editor/interop-v4";
import { V4_CORE_EXTENSIONS } from "../editor/extensions-v4";
import { createEditorExtensionsV4 } from "../editor/schema";
import { numberedItemEnter, numberedItemIndent, numberLabels } from "./numbered-item";

/** Invented ids and text only (acceptance 1 to 3 of WEB-1608). */
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
const item = (n: number, level: number, text: string) => ({
  type: "numberedItem",
  attrs: { nodeId: ids[n], level },
  content: [{ type: "text", text }],
});

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
const levels = (e: Editor) => (e.getJSON().content ?? []).map((n) => n.attrs?.level);
function caret(e: Editor, block: number, offset: number): void {
  let pos = -1;
  let seen = 0;
  e.state.doc.descendants((node, at) => {
    if (pos === -1 && node.isTextblock && seen++ === block) pos = at + 1 + offset;
  });
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, pos)));
}

describe("numbered item: Tab and Shift-Tab change the level (acceptance 1)", () => {
  it("Tab goes one level deeper, up to 3; Shift-Tab goes back, down to 1", () => {
    const e = setUp([item(0, 1, "Prvo"), item(1, 1, "Drugo")]);
    caret(e, 1, 2);
    expect(numberedItemIndent(e, 1)).toBe(true);
    expect(levels(e)).toEqual([1, 2]);
    expect(numberedItemIndent(e, 1)).toBe(true);
    expect(levels(e)).toEqual([1, 3]);
    // At the deepest level Tab is still ours (focus stays), the level stays.
    expect(numberedItemIndent(e, 1)).toBe(true);
    expect(levels(e)).toEqual([1, 3]);
    expect(numberedItemIndent(e, -1)).toBe(true);
    expect(numberedItemIndent(e, -1)).toBe(true);
    expect(levels(e)).toEqual([1, 1]);
    // On level 1 Shift-Tab is left to the browser.
    expect(numberedItemIndent(e, -1)).toBe(false);
  });

  it("does nothing outside a numbered item", () => {
    const e = setUp([{ type: "paragraph", content: [{ type: "text", text: "Odlomak" }] }]);
    caret(e, 0, 2);
    expect(numberedItemIndent(e, 1)).toBe(false);
  });

  it("Enter at the end opens an item on the same level; Enter on an empty one goes up, then to a paragraph", () => {
    const e = setUp([item(0, 1, "Prvo"), item(1, 2, "Pod")]);
    caret(e, 1, 3);
    expect(numberedItemEnter(e)).toBe(true);
    expect(levels(e)).toEqual([1, 2, 2]);
    expect(numberedItemEnter(e)).toBe(true);
    expect(levels(e)).toEqual([1, 2, 1]);
    expect(numberedItemEnter(e)).toBe(true);
    expect((e.getJSON().content ?? []).map((n) => n.type)).toEqual(["numberedItem", "numberedItem", "paragraph"]);
  });

  it("the type-ahead '1. ' makes the block an item with the same id", () => {
    const e = setUp([{ type: "paragraph", attrs: { nodeId: ids[0] }, content: [{ type: "text", text: "Tekst" }] }]);
    e.chain().setTextSelection(2).toggleNode("numberedItem", "paragraph").run();
    expect(e.getJSON().content?.[0]).toMatchObject({ type: "numberedItem", attrs: { nodeId: ids[0], level: 1 } });
  });
});

describe("numbers: the editor and the document agree (acceptance 2)", () => {
  it("the editor labels equal the numbers derived from the canonical document", () => {
    const e = setUp([item(0, 1, "A"), item(1, 2, "B"), item(2, 1, "C")]);
    expect(numberLabels(e.state.doc).map((l) => l.label)).toEqual(["1.", "1.1.", "2."]);
    const out = tiptapToCanonicalV4(e.getJSON());
    expect(out.ok).toBe(true);
  });
});

describe("schema: numberedItem in document v4 (acceptance 3)", () => {
  const doc = (nodes: unknown[]) => ({ schemaVersion: DOCUMENT_SCHEMA_VERSION_V4, nodes, sources: [] });
  const node = (extra: Record<string, unknown> = {}) => ({
    type: "numberedItem", id: ids[0], level: 2, children: [{ type: "text", text: "Stavka", marks: [] }], ...extra,
  });

  it("validates, and round-trips through the editor JSON unchanged", () => {
    const result = validateDocumentV4(doc([node()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const back = tiptapToCanonicalV4(canonicalToTiptapV4(result.doc));
    expect(back).toMatchObject({ ok: true });
    if (back.ok) expect(back.doc.nodes).toEqual(result.doc.nodes);
  });

  it.each([0, 4, 1.5, "1", null])("refuses level %s", (level) => {
    expect(validateDocumentV4(doc([node({ level })]))).toMatchObject({ ok: false });
  });

  it("refuses a missing level and unknown fields", () => {
    const { level: _l, ...noLevel } = node();
    expect(validateDocumentV4(doc([noLevel]))).toMatchObject({ ok: false });
    expect(validateDocumentV4(doc([node({ number: "1." })]))).toMatchObject({ ok: false });
  });

  it("the other versions still do not know the node (no change of their format)", async () => {
    const { validateVersionedDocument } = await import("../document/document");
    expect(validateVersionedDocument({ ...doc([node()]), schemaVersion: 3 })).toMatchObject({ ok: false });
  });
});
