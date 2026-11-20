// @vitest-environment node
import { Editor, getSchema, type JSONContent } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";

import { isNodeId } from "../document/document/schema";
import { V4_CORE_EXTENSIONS } from "./extensions-v4";
import { withoutNodeIds } from "./identity";
import { NODE_ID_ATTRIBUTE } from "./interop";
import { tiptapToCanonicalV4 } from "./interop-v4";
import { createEditorExtensionsV4 } from "./schema";

/**
 * Block identity in the v4 editor (contract v4 §2): the box, every paragraph
 * in it and every atom block carry an id of their own. Synthetic ids only.
 */
const BOX = "aaaaaaaa-aaaa-4aaa-8aaa-0000000000b0";
const IN_BOX = "aaaaaaaa-aaaa-4aaa-8aaa-0000000000b1";
const AFTER = "aaaaaaaa-aaaa-4aaa-8aaa-0000000000c0";

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

const text = (value: string) => [{ type: "text", text: value }];

/** `[type, id]` of every block that carries an id, in document order. */
function ids(e: Editor): [string, unknown][] {
  const found: [string, unknown][] = [];
  e.state.doc.descendants((node) => {
    if (NODE_ID_ATTRIBUTE in node.attrs) found.push([node.type.name, node.attrs[NODE_ID_ATTRIBUTE]]);
    return !node.isTextblock;
  });
  return found;
}

function at(e: Editor, pos: number): void {
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, pos)));
}

function boxed(): Editor {
  return setUp([
    { type: "box", attrs: { nodeId: BOX, kind: "theorem" }, content: [{ type: "paragraph", attrs: { nodeId: IN_BOX }, content: text("Prvi stavak") }] },
    { type: "paragraph", attrs: { nodeId: AFTER }, content: text("Nakon okvira") },
  ]);
}

describe("node identity in the v4 editor", () => {
  it("mints an id for a box, its paragraphs and every atom block at creation", () => {
    const e = setUp([
      { type: "box", attrs: { kind: "proof" }, content: [{ type: "paragraph" }, { type: "paragraph" }] },
      { type: "table", attrs: { rows: [["a"]], header: false, stripes: false, landscape: false } },
      { type: "codeBlock" },
      { type: "pageBreak" },
    ]);
    e.view.dispatch(e.state.tr.insertText("x", 2));
    const found = ids(e);
    expect(found.map(([type]) => type)).toEqual(["box", "paragraph", "paragraph", "table", "codeBlock", "pageBreak"]);
    expect(found.every(([, id]) => isNodeId(id))).toBe(true);
    expect(new Set(found.map(([, id]) => id)).size).toBe(found.length);
  });

  it("keeps the ids of a box and its paragraph while typing in it", () => {
    const e = boxed();
    e.view.dispatch(e.state.tr.insertText("Novi ", 2));
    expect(ids(e)).toEqual([["box", BOX], ["paragraph", IN_BOX], ["paragraph", AFTER]]);
  });

  it("gives the second half of a paragraph split in a box a new id", () => {
    const e = boxed();
    at(e, 6);
    e.commands.splitBlock();
    const found = ids(e);
    expect(found.slice(0, 2)).toEqual([["box", BOX], ["paragraph", IN_BOX]]);
    expect(found[2]![0]).toBe("paragraph");
    expect(isNodeId(found[2]![1])).toBe(true);
    expect([BOX, IN_BOX, AFTER]).not.toContain(found[2]![1]);
    expect(tiptapToCanonicalV4(e.getJSON()).ok).toBe(true);
  });

  it("keeps the paragraphs' ids when they are wrapped in a box and lifted out", () => {
    const e = boxed();
    at(e, e.state.doc.content.size - 2);
    e.commands.wrapBox("remark");
    const wrapped = ids(e);
    expect(wrapped.slice(0, 3)).toEqual([["box", BOX], ["paragraph", IN_BOX], ["box", wrapped[2]![1]]]);
    expect([BOX, IN_BOX, AFTER, null]).not.toContain(wrapped[2]![1]);
    expect(wrapped[3]).toEqual(["paragraph", AFTER]);
    at(e, 2);
    e.commands.unwrapBox();
    expect(ids(e)).toEqual([["paragraph", IN_BOX], ["box", wrapped[2]![1]], ["paragraph", AFTER]]);
  });

  it("strips the ids of a box and its paragraphs from pasted content", () => {
    const schema = getSchema(createEditorExtensionsV4());
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [{ type: "box", attrs: { nodeId: BOX, kind: "lemma" }, content: [{ type: "paragraph", attrs: { nodeId: IN_BOX } }] }],
    });
    const stripped = withoutNodeIds(new Slice(doc.content, 0, 0));
    const box = stripped.content.firstChild!;
    expect(box.attrs[NODE_ID_ATTRIBUTE]).toBeNull();
    expect(box.firstChild!.attrs[NODE_ID_ATTRIBUTE]).toBeNull();
  });
});
