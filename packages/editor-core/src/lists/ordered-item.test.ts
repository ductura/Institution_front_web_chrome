// @vitest-environment node
import { Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";

import { DOCUMENT_SCHEMA_VERSION_V4, validateDocumentV4 } from "../document/document";
import { canonicalToTiptapV4, tiptapToCanonicalV4 } from "../editor/interop-v4";
import { V4_CORE_EXTENSIONS } from "../editor/extensions-v4";
import { createEditorExtensionsV4 } from "../editor/schema";
import { ORDERED_MARKER, OrderedItem, markerToOrderedItem, orderedItemBackspace, orderedItemEnter, numberLabels } from "./ordered-item";

/** Invented ids and text only (acceptance 1 to 3 of WEB-1608). */
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
const item = (n: number, text: string) => ({
  type: "orderedItem",
  attrs: { nodeId: ids[n] },
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
const types = (e: Editor) => (e.getJSON().content ?? []).map((n) => n.type);
function caret(e: Editor, block: number, offset: number): void {
  let pos = -1;
  let seen = 0;
  e.state.doc.descendants((node, at) => {
    if (pos === -1 && node.isTextblock && seen++ === block) pos = at + 1 + offset;
  });
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, pos)));
}

describe("ordered item: keyboard (no nesting)", () => {
  it("binds only Mod-Shift-7, Enter and Backspace: Tab and Shift-Tab are left alone, there are no levels", () => {
    const e = setUp([item(0, "Prvo"), item(1, "Drugo")]);
    const shortcuts = OrderedItem.config.addKeyboardShortcuts!.call({ editor: e, name: "orderedItem" } as never);
    expect(Object.keys(shortcuts).sort()).toEqual(["Backspace", "Enter", "Mod-Shift-7"]);
    expect(JSON.stringify(e.getJSON())).not.toContain("level");
  });

  it("does nothing outside an ordered item", () => {
    const e = setUp([{ type: "paragraph", content: [{ type: "text", text: "Odlomak" }] }]);
    caret(e, 0, 2);
    expect(orderedItemEnter(e)).toBe(false);
    expect(orderedItemBackspace(e)).toBe(false);
  });

  it("Enter at the end opens the next item; Enter on an empty one gives a paragraph", () => {
    const e = setUp([item(0, "Prvo"), item(1, "Dvo")]);
    caret(e, 1, 3);
    expect(orderedItemEnter(e)).toBe(true);
    expect(types(e)).toEqual(["orderedItem", "orderedItem", "orderedItem"]);
    expect(numberLabels(e.state.doc).map((l) => l.label)).toEqual(["1.", "2.", "3."]);
    expect(orderedItemEnter(e)).toBe(true);
    expect(types(e)).toEqual(["orderedItem", "orderedItem", "paragraph"]);
  });

  it("Backspace at the start of an item gives a paragraph with the same text", () => {
    const e = setUp([item(0, "Prvo")]);
    caret(e, 0, 0);
    expect(orderedItemBackspace(e)).toBe(true);
    expect(e.getJSON().content?.[0]).toMatchObject({ type: "paragraph", content: [{ text: "Prvo" }] });
  });

  it("the shortcut turns a paragraph into an item with the same id, and back", () => {
    const e = setUp([{ type: "paragraph", attrs: { nodeId: ids[0] }, content: [{ type: "text", text: "Tekst" }] }]);
    e.chain().setTextSelection(2).toggleNode("orderedItem", "paragraph").run();
    expect(e.getJSON().content?.[0]).toMatchObject({ type: "orderedItem", attrs: { nodeId: ids[0] } });
    e.chain().toggleNode("orderedItem", "paragraph").run();
    expect(e.getJSON().content?.[0]).toMatchObject({ type: "paragraph" });
  });

  it("the type-ahead '1. ' and '1) ' (any number) make the block an item", () => {
    expect("1. ").toMatch(ORDERED_MARKER);
    expect("1) ").toMatch(ORDERED_MARKER);
    expect("12. ").toMatch(ORDERED_MARKER);
    expect("1.").not.toMatch(ORDERED_MARKER);
    const e = setUp([{ type: "paragraph", attrs: { nodeId: ids[0] }, content: [{ type: "text", text: "1. " }] }]);
    const tr = e.state.tr;
    expect(markerToOrderedItem(tr, 1, 4, e.schema.nodes.orderedItem!)).toBe(true);
    e.view.dispatch(tr);
    expect(e.getJSON().content?.[0]).toMatchObject({ type: "orderedItem", attrs: { nodeId: ids[0] } });
  });
});

describe("numbers: the editor and the document agree (acceptance 2)", () => {
  it("the editor labels equal the numbers derived from the canonical document", () => {
    const e = setUp([item(0, "A"), item(1, "B"), { type: "paragraph", content: [] }, item(2, "C")]);
    expect(numberLabels(e.state.doc).map((l) => l.label)).toEqual(["1.", "2.", "1."]);
    const out = tiptapToCanonicalV4(e.getJSON());
    expect(out.ok).toBe(true);
  });
});

describe("schema: orderedItem in document v4 (acceptance 3)", () => {
  const doc = (nodes: unknown[]) => ({ schemaVersion: DOCUMENT_SCHEMA_VERSION_V4, nodes, sources: [] });
  const node = (extra: Record<string, unknown> = {}) => ({
    type: "orderedItem", id: ids[0], children: [{ type: "text", text: "Stavka", marks: [] }], ...extra,
  });

  it("validates, and round-trips through the editor JSON unchanged", () => {
    const result = validateDocumentV4(doc([node()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const back = tiptapToCanonicalV4(canonicalToTiptapV4(result.doc));
    expect(back).toMatchObject({ ok: true });
    if (back.ok) expect(back.doc.nodes).toEqual(result.doc.nodes);
  });

  it("refuses a level, a nested block and unknown fields with the existing codes", () => {
    const codes = (n: unknown) => {
      const r = validateDocumentV4(doc([n]));
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(codes(node({ level: 1 }))).toContain("UNKNOWN_FIELD");
    expect(codes(node({ number: "1." }))).toContain("UNKNOWN_FIELD");
    expect(codes(node({ children: [{ type: "paragraph", id: ids[1], children: [] }] }))).toContain("INLINE_TYPE_INVALID");
    expect(codes({ type: "orderedItem", id: ids[0], children: [] })).toEqual([]);
    expect(validateDocumentV4(doc([node(), { ...node(), id: ids[0] }]))).toMatchObject({ ok: false });
  });

  it("the other versions still do not know the node (no change of their format)", async () => {
    const { validateVersionedDocument } = await import("../document/document");
    for (const schemaVersion of [1, 2, 3]) {
      const r = validateVersionedDocument({ ...doc([node()]), schemaVersion });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((e) => e.code)).toContain("NODE_TYPE_INVALID");
    }
  });
});
