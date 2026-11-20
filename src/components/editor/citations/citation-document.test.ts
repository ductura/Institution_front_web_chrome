import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { createEditorExtensions, createEditorExtensionsV2, tiptapToCanonicalV2 } from "@/editor";
import { expect, it } from "vitest";
import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";

import { citationRange, insertCitation, validCitationPage } from "./citation-document";
import { citationMessagesHr } from "./messages.hr";

const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const schema = getSchema(createEditorExtensionsV2());
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const source = { id: sourceId, type: "book", authors: [{ kind: "organization", name: "Izmišljeni institut" }],
  year: 2026, title: "Izmišljeni izvor", place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik" };

it("keeps citation and review copy within the Croatian product vocabulary", () => {
  expect(findForbiddenTerms(JSON.stringify(citationMessagesHr), "hr")).toEqual([]);
});

function stateFor(type = "paragraph", version = 2) {
  const activeSchema = version === 2 ? schema : getSchema(createEditorExtensions());
  const doc = activeSchema.nodeFromJSON({ type: "doc", attrs: { sources: [source] }, content: [
    { type, attrs: { nodeId: id }, content: [{ type: "text", text: "Izmišljeni opis." }] },
  ] });
  return EditorState.create({ doc, selection: TextSelection.create(doc, 1, 10) });
}

it("replaces the selected text with a citation atom using the canonical locator", () => {
  const state = stateFor();
  const tr = insertCitation(state, citationRange(state)!, sourceId, "14–16")!;
  const result = tiptapToCanonicalV2(tr.doc.toJSON());
  expect(result.ok && result.doc.nodes[0]?.children[0]).toEqual({ type: "citation", sourceId, locator: "14–16" });
  expect(tr.selection.from).toBe(3);
});

it("omits an empty locator and validates its Unicode length and characters", () => {
  const state = stateFor();
  const tr = insertCitation(state, citationRange(state)!, sourceId, "")!;
  const result = tiptapToCanonicalV2(tr.doc.toJSON());
  expect(result.ok && result.doc.nodes[0]?.children[0]).toEqual({ type: "citation", sourceId });
  expect(validCitationPage("🌿".repeat(100))).toBe(true);
  expect(validCitationPage("🌿".repeat(101))).toBe(false);
  expect(validCitationPage("14\u200B")).toBe(false);
});

it("refuses a v1 document, a heading, an invalid source and a moved selection", () => {
  expect(citationRange(stateFor("paragraph", 1))).toBeNull();
  expect(citationRange(stateFor("heading"))).toBeNull();
  const state = stateFor();
  const range = citationRange(state)!;
  expect(insertCitation(state, range, "izmišljeni-izvor", "14")).toBeNull();
  expect(insertCitation(state, range, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "14")).toBeNull();
  const moved = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)));
  expect(insertCitation(moved, range, sourceId, "14")).toBeNull();
});
