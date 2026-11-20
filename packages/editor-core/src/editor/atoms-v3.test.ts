// @vitest-environment node
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { canonicalToTiptapV3, tiptapToCanonicalV3 } from "./interop-v3";
import { createEditorExtensionsV3 } from "./schema";
import { validateVersionedDocument } from "../document/document/validate";
import type { CanonicalDocumentV3, NodeId } from "../document/document/schema";

/** Synthetic ids and text only. Document-schema-v3 §3, §5 and class 45. */
const P = "aaaaaaaa-0000-4000-8000-00000000000a" as NodeId;
const H = "aaaaaaaa-0000-4000-8000-00000000000b" as NodeId;
const SRC = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RQ = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const DOC = {
  schemaVersion: 3,
  sources: [],
  nodes: [
    { type: "heading", id: H, level: 1, children: [{ type: "text", text: "Naslov", marks: [] }] },
    {
      type: "paragraph",
      id: P,
      children: [
        { type: "text", text: "Ab", marks: [] },
        { type: "citation", sourceId: SRC, locator: "str. 12", via: "Izmišljeni, 1973", rq: RQ },
        { type: "footnote", text: "Objašnjenje." },
        { type: "crossReference", targetId: H },
        { type: "citation", sourceId: SRC },
      ],
    },
  ],
} as unknown as CanonicalDocumentV3;

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function setUp(content: object) {
  editor = new Editor({ element: null, extensions: createEditorExtensionsV3(), content });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}

describe("v3 atoms and interop", () => {
  it("the fixture is a valid v3 document", () => {
    expect(validateVersionedDocument(DOC)).toMatchObject({ ok: true });
  });

  it("round-trips canonical → Tiptap → canonical, byte for byte", () => {
    const result = tiptapToCanonicalV3(canonicalToTiptapV3(DOC));
    expect(result).toEqual({ ok: true, doc: DOC });
  });

  it("the v3 editor schema holds the same JSON as the projection", () => {
    const json = canonicalToTiptapV3(DOC);
    const e = setUp(json);
    expect(tiptapToCanonicalV3(e.getJSON())).toEqual({ ok: true, doc: DOC });
  });

  it("takes marks off all three atoms", () => {
    const e = setUp(canonicalToTiptapV3(DOC));
    e.commands.selectAll();
    e.commands.toggleBold();
    const marked: string[] = [];
    e.state.doc.descendants((node) => {
      if (["citation", "footnote", "crossReference"].includes(node.type.name)) marked.push(`${node.type.name}:${node.marks.length}`);
    });
    expect(marked).toEqual(["citation:0", "footnote:0", "crossReference:0", "citation:0"]);
  });

  it("reports a marked atom and an unknown attribute, never repairs them", () => {
    const json = canonicalToTiptapV3(DOC) as { content: { content?: unknown[] }[] };
    const para = json.content[1]!.content!;
    para[2] = { type: "footnote", attrs: { text: "x", kind: "f" } };
    expect(tiptapToCanonicalV3(json)).toMatchObject({ ok: false });
    para[2] = { type: "footnote", attrs: { text: "x" }, marks: [{ type: "bold" }] };
    expect(tiptapToCanonicalV3(json)).toMatchObject({ ok: false });
  });

  it("the validator is the last gate: an empty footnote is refused", () => {
    const json = canonicalToTiptapV3(DOC) as { content: { content?: unknown[] }[] };
    json.content[1]!.content![2] = { type: "footnote", attrs: { text: "" } };
    expect(tiptapToCanonicalV3(json)).toMatchObject({ ok: false });
  });
});
