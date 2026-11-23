// @vitest-environment node
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { revisionZeroDocument, revisionZeroDocumentV3 } from "../document/document/revision-zero";
import type { CanonicalDocumentV3 } from "../document/document";
import { replaceWithStoredDocumentV3 } from "./identity";
import { canonicalToTiptap } from "./interop";
import { canonicalToTiptapV3, tiptapToCanonicalV3 } from "./interop-v3";
import { createEditorExtensions, createEditorExtensionsV3 } from "./schema";
import { storableDocumentV3 } from "./storable-text";

/**
 * PIL-K-SPREMANJE-V3: a stored v3 document enters the v3 sheet whole, its
 * sources included, and is never repaired. Invented text and ids only.
 */

const SOURCE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "book", title: "Izmišljeni izvor", year: 2020,
  authors: [{ kind: "person", family: "Prezime", given: "Ime" }], place: "Zagreb", publisher: "Nakladnik",
} as const;

const STORED = {
  schemaVersion: 3,
  sources: [SOURCE],
  nodes: [{
    type: "paragraph", id: "bbbbbbbb-0000-4000-8000-000000000001",
    children: [
      { type: "text", text: "Uvod", marks: [] },
      { type: "citation", sourceId: SOURCE.id, locator: "str. 7" },
      { type: "footnote", text: "Izmišljena bilješka." },
    ],
  }],
} as unknown as CanonicalDocumentV3;

const editors: Editor[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });

function sheet(v3 = true) {
  const editor = new Editor({
    element: null,
    extensions: v3 ? createEditorExtensionsV3() : createEditorExtensions(),
    content: v3 ? canonicalToTiptapV3(revisionZeroDocumentV3()) : canonicalToTiptap(revisionZeroDocument()),
  });
  editors.push(editor);
  return editor;
}

describe("replaceWithStoredDocumentV3", () => {
  it("loads the nodes and the sources, so the sheet projects back to the same document", () => {
    const editor = sheet();
    expect(replaceWithStoredDocumentV3(editor.view, STORED)).toEqual({ ok: true });
    const back = tiptapToCanonicalV3(editor.getJSON());
    expect(back).toEqual({ ok: true, doc: STORED });
    // Not an edit: nothing to undo.
    expect(editor.can().undo()).toBe(false);
  });

  it("refuses a v1 document and an invalid v3 one, leaving the sheet as it was", () => {
    const editor = sheet();
    const before = editor.getJSON();
    expect(replaceWithStoredDocumentV3(editor.view, revisionZeroDocument() as unknown as CanonicalDocumentV3).ok).toBe(false);
    const repeated = { ...STORED, nodes: [STORED.nodes[0]!, STORED.nodes[0]!] } as CanonicalDocumentV3;
    expect(replaceWithStoredDocumentV3(editor.view, repeated).ok).toBe(false);
    expect(editor.getJSON()).toEqual(before);
  });
});

describe("storableDocumentV3", () => {
  it("returns the same document when every text is storable", () => {
    expect(storableDocumentV3(STORED)).toBe(STORED);
  });

  it("makes a lone surrogate in a footnote or a text run storable", () => {
    const lone = String.fromCharCode(0xd800);
    const withLone = {
      ...STORED,
      nodes: [{ ...STORED.nodes[0]!, children: [{ type: "text", text: `Uv${lone}od`, marks: [] }, { type: "footnote", text: `Bil${lone}ješka` }] }],
    } as unknown as CanonicalDocumentV3;
    const stored = storableDocumentV3(withLone);
    expect(stored).not.toBe(withLone);
    expect(stored.nodes[0]!.children).toEqual([{ type: "text", text: "Uv�od", marks: [] }, { type: "footnote", text: "Bil�ješka" }]);
  });
});
