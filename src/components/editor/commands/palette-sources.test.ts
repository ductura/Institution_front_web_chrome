// @vitest-environment jsdom
// jsdom: a headless editor (element: null) reads as destroyed, so the palette would only see a locked work.
import { Editor } from "@tiptap/core";
import { visibleCommands } from "@ductura/ui";
import { describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { paletteActions } from "./palette";

// ED-46 (P2-18), part 2: the palette's "Izvori", chapters only for a query, and a submitted work's short list.
// Invented work and source.
const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const source = { id: sourceId, type: "book", authors: [{ kind: "organization", name: "Izmišljeni institut" }],
  year: 2026, title: "Izmišljena povijest mostova", place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik" };

function editorWith(editable: boolean) {
  const editor = new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV2(), editable, content: {
    type: "doc", attrs: { sources: [source] }, content: [
      { type: "heading", attrs: { level: 1, nodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" }, content: [{ type: "text", text: "Uvod" }] },
      { type: "paragraph", attrs: { nodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, content: [{ type: "text", text: "Izmišljen tekst o mostovima." }] },
    ] } });
  return editor;
}
const ids = (list: readonly { id: string }[]) => list.map((c) => c.id);

describe("palette sources and chapters", () => {
  it("finds a source by author, year or title and cites it at the cursor", () => {
    const editor = editorWith(true);
    editor.commands.setTextSelection(editor.state.doc.content.size - 2);
    const actions = paletteActions(editor as never, () => {});
    for (const query of ["institut", "2026", "mostova"]) expect(ids(visibleCommands(actions, query, []))).toContain(`source:${sourceId}`);
    const cite = actions.find((a) => a.id === `source:${sourceId}`)!;
    expect(cite).toMatchObject({ group: "Izvori", hint: "umetni navod", disabled: false });
    cite.run!();
    const citations: unknown[] = [];
    editor.state.doc.descendants((node) => { if (node.type.name === "citation") citations.push(node.attrs.sourceId); });
    expect(citations).toEqual([sourceId]);
    editor.destroy();
  });

  it("lists chapters and sources only for a typed query, never in the empty list", () => {
    const editor = editorWith(true);
    const actions = paletteActions(editor as never, () => {});
    const empty = ids(visibleCommands(actions, "", []));
    expect(empty.some((id) => id.startsWith("heading:") || id.startsWith("source:"))).toBe(false);
    expect(ids(visibleCommands(actions, "uvod", [])).some((id) => id.startsWith("heading:"))).toBe(true);
    editor.destroy();
  });

  it("gives a submitted work only what it still allows: reading, finding, chapters; no sources to cite", () => {
    const editor = editorWith(false);
    const actions = paletteActions(editor as never, () => {});
    const listed = ids(actions);
    expect(listed).toEqual(expect.arrayContaining(["shortcuts", "find", "focus", "copy", "outline", "docx", "print"]));
    expect(listed).not.toContain("bold");
    expect(listed).not.toContain("hole");
    expect(listed).not.toContain("cite");
    expect(listed.some((id) => id.startsWith("source:"))).toBe(false);
    expect(listed.some((id) => id.startsWith("heading:"))).toBe(true);
    editor.destroy();
  });
});
