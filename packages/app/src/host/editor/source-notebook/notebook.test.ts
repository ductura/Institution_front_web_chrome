import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { expect, it, vi } from "vitest";
import { createEditorExtensions, createEditorExtensionsV2, tiptapToCanonicalV2 } from "@/editor";
import { readSourceNotes } from "@/client/source-notebook";
import { findNotes, insertNotebookCitation, loadNotebook, type NotebookEntry } from "./notebook";

const source = { id: "00000000-0000-4000-8000-00000000c0a1", label: "Izmišljeni institut (2026)" };
const entry: NotebookEntry = {
  id: "00000000-0000-4000-8000-00000000b001",
  source,
  quote: "Kišni vrt zadržava vodu.",
  page: "12–14",
  note: "Usporediti vrste tla.",
};

function editorState(version = 2) {
  const schema = getSchema(version === 2 ? createEditorExtensionsV2() : createEditorExtensions());
  const doc = schema.nodeFromJSON({ type: "doc", attrs: { sources: [{
    id: source.id, type: "book", title: "Izmišljeni vrt", year: 2026,
    authors: [{ kind: "organization", name: "Izmišljeni institut" }],
    place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik",
  }] }, content: [{
    type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" },
    content: [{ type: "text", text: "Mjesto za navod." }],
  }] });
  return EditorState.create({ doc, selection: TextSelection.create(doc, 1, 8) });
}

it("searches quote, private note, page and source without requiring diacritics", () => {
  const other = { ...entry, id: "other", quote: "Izmišljeni park.", note: null, page: "99" };
  for (const query of ["KISNI vrste", "12–14 institut", "usPOREDITi"]) {
    expect(findNotes([entry, other], query)).toEqual([entry]);
  }
  expect(findNotes([entry, other], "nepostojeće")).toEqual([]);
});

it("inserts the quotation and existing citation atom with locator in one transaction", () => {
  const tr = insertNotebookCitation(editorState(), entry)!;
  const result = tiptapToCanonicalV2(tr.doc.toJSON());
  expect(result.ok && result.doc.nodes[0]?.children).toMatchObject([
    { type: "text", text: "„Kišni vrt zadržava vodu.” " },
    { type: "citation", sourceId: source.id, locator: "12–14" },
    { type: "text", text: " za navod." },
  ]);
  expect(tr.doc.textContent).not.toContain(entry.note);
  expect(tr.selection.$from.nodeBefore?.text).toBe(" ");
});

it("inserts only a reference when no quotation was saved and refuses unsupported placements", () => {
  const state = editorState();
  const reference = insertNotebookCitation(state, { ...entry, quote: null });
  expect(reference?.doc.firstChild?.firstChild?.type.name).toBe("citation");
  expect(reference?.doc.textContent).not.toContain(entry.note);
  expect(insertNotebookCitation(state, { ...entry, page: null })).toBeNull();
  expect(insertNotebookCitation(state, { ...entry, page: "14\u200B" })).toBeNull();
  expect(insertNotebookCitation(state, { ...entry, source: { ...source, id: entry.id } })).toBeNull();
  expect(insertNotebookCitation(editorState(1), entry)).toBeNull();
});

it("loads by document and source ID through the shared client and keeps private responses out of the cache", async () => {
  const { source: _, ...note } = entry;
  const signal = new AbortController().signal;
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ notes: [note] }));
  const result = await loadNotebook("doc-izmišljeni-vrt", [source], signal, (documentId, sourceId) =>
    readSourceNotes(documentId, sourceId, signal, { baseUrl: "https://ductura.invalid", fetchImpl }));
  expect(result).toEqual({ kind: "ready", entries: [entry], incomplete: false });
  expect(fetchImpl).toHaveBeenCalledWith(
    new URL(`https://ductura.invalid/api/v1/works/doc-izmi%C5%A1ljeni-vrt/sources/${source.id}/notes`),
    expect.objectContaining({ cache: "no-store", method: "GET", signal }),
  );
});

it("keeps successful results on a partial failure and drops them after a 401", async () => {
  const other = { id: "other", label: "Izmišljeni park" };
  const { source: _, ...note } = entry;
  const signal = new AbortController().signal;
  const ready = { kind: "ready", notes: [note] } as const;
  expect(await loadNotebook("demo", [source, other], signal, async (_id, sourceId) =>
    sourceId === source.id ? ready : { kind: "unavailable" }))
    .toEqual({ kind: "ready", entries: [entry], incomplete: true });
  expect(await loadNotebook("demo", [source, other], signal, async (_id, sourceId) =>
    sourceId === source.id ? ready : { kind: "signedOut" })).toEqual({ kind: "signedOut" });
});
