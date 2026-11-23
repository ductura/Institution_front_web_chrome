// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { canonicalToTiptapV3, tiptapToCanonicalV3 } from "./interop-v3";
import { createEditorExtensionsV3 } from "./schema";
import type { CanonicalDocumentV3, NodeId } from "../document/document/schema";

/** Synthetic text only. The footnote mark is a display of the order of footnotes in the document. */
const P1 = "aaaaaaaa-0000-4000-8000-00000000000a" as NodeId;
const P2 = "aaaaaaaa-0000-4000-8000-00000000000b" as NodeId;

const DOC = {
  schemaVersion: 3,
  sources: [],
  nodes: [
    {
      type: "paragraph",
      id: P1,
      children: [
        { type: "text", text: "Ab", marks: [] },
        { type: "footnote", text: "Prva." },
        { type: "text", text: "cd", marks: [] },
        { type: "footnote", text: "Druga." },
      ],
    },
    { type: "paragraph", id: P2, children: [{ type: "footnote", text: "Treća." }] },
  ],
} as unknown as CanonicalDocumentV3;

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function mount(doc: CanonicalDocumentV3) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createEditorExtensionsV3(), content: canonicalToTiptapV3(doc) });
  return editor;
}

const marks = (e: Editor) => Array.from(e.view.dom.querySelectorAll<HTMLElement>("span[data-footnote]"));

describe("footnote mark", () => {
  it("shows the number in document order as a focusable button", () => {
    const list = marks(mount(DOC));
    expect(list.map((m) => m.textContent)).toEqual(["1", "2", "3"]);
    expect(list.map((m) => m.getAttribute("aria-label"))).toEqual(["Fusnota 1", "Fusnota 2", "Fusnota 3"]);
    for (const m of list) {
      expect(m.getAttribute("role")).toBe("button");
      expect(m.getAttribute("tabindex")).toBe("0");
      expect(m.querySelector("sup")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("renumbers when a footnote is inserted before the others, without touching the document", () => {
    const e = mount(DOC);
    e.commands.insertContentAt(1, { type: "footnote", attrs: { text: "Nova." } });
    expect(marks(e).map((m) => m.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(marks(e).map((m) => m.getAttribute("data-text"))).toEqual(["Nova.", "Prva.", "Druga.", "Treća."]);
  });

  it("keeps the canonical document byte for byte: the number is not stored", () => {
    const e = mount(DOC);
    const result = tiptapToCanonicalV3(e.getJSON());
    expect(result).toEqual({ ok: true, doc: DOC });
    expect(JSON.stringify(e.getJSON())).not.toContain("number");
    // Same bytes as the projection of the stored JSON, which has no editor in it.
    expect(JSON.stringify(result)).toBe(JSON.stringify(tiptapToCanonicalV3(canonicalToTiptapV3(DOC))));
  });

  it("copies as the empty span: the rendered HTML does not carry the number", () => {
    const html = mount(DOC).getHTML();
    expect(html).toContain("<span data-footnote=\"\" data-text=\"Prva.\"></span>");
    expect(html).not.toContain("<sup");
  });
});
