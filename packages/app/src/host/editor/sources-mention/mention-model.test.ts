import { getSchema } from "@tiptap/core";
import type { SourceDraft } from "@ductura/ui";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { createEditorExtensionsV2, tiptapToCanonicalV2 } from "@/editor";
import { triggerItems } from "@/components/editor/triggers/items";
import { addSourceAt, addSourceTransaction, listedSources, mentionSources, nextPlace, plainCitationPlaces } from "./mention-model";

const ID = "00000000-0000-4000-8000-00000000c0a1";
const NEW = "00000000-0000-4000-8000-00000000c0a2";
const book = { id: ID, type: "book", title: "Izmišljeni vrt", year: 2026, place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik",
  authors: [{ kind: "organization", name: "Izmišljeni institut" }] };
const draft: SourceDraft = { type: "article", title: "Kišni vrtovi", year: 2025, journal: "Izmišljeni časopis",
  authors: [{ kind: "person", family: "Izmišljeni", given: "Ana" }] };

function stateWith(text: string, sources: unknown[] = [book], select = 1) {
  const schema = getSchema(createEditorExtensionsV2());
  const doc = schema.nodeFromJSON({ type: "doc", attrs: { sources }, content: [{
    type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" }, content: [{ type: "text", text }] }] });
  return EditorState.create({ doc, selection: TextSelection.create(doc, select) });
}
const view = (state: EditorState) => { const v = { state, dispatch: (tr: Parameters<EditorState["apply"]>[0]) => { v.state = v.state.apply(tr); } }; return v; };

it("lists the sources of the work as menu rows, with notes that have a page", () => {
  const rows = mentionSources([book, { id: "x" }, null], [
    { sourceId: ID, id: "n1", page: " 14 ", text: "Usporediti vrste tla." },
    { sourceId: ID, id: "n2", page: null, text: "bez stranice" },
    { sourceId: "other", id: "n3", page: "3", text: "tuđa" },
  ]);
  expect(rows).toEqual([{ id: ID, label: "Izmišljeni institut (2026)", title: "Izmišljeni vrt", search: "Izmišljeni vrt",
    notes: [{ id: "n1", page: "14", text: "Usporediti vrste tla." }] }]);
  expect(mentionSources(undefined)).toEqual([]);
});

it("gives the '@' menu the sources, their notes and 'Dodaj novi izvor…'; an empty list still offers the addition", () => {
  const trigger = { mode: "at", query: "izm", from: 1, to: 5 } as const;
  const rows = mentionSources([book], [{ sourceId: ID, id: "n1", page: "14", text: "Usporediti vrste tla." }]);
  const items = triggerItems(trigger, rows, { cite: () => {}, addSource: () => {} }, () => {});
  expect(items.map((i) => i.label)).toEqual(["Izmišljeni institut (2026)", "Izmišljeni institut (2026), str. 14", "Dodaj novi izvor…"]);
  expect(items.every((i) => !i.disabled)).toBe(true);
  const none = triggerItems({ ...trigger, query: "" }, [], { addSource: () => {} }, () => {});
  expect(none.map((i) => [i.id, i.disabled])).toEqual([["add", false]]);
});

it("adds a source to the work and cites it at the cursor in the same flow", () => {
  const v = view(stateWith("Mjesto za navod.", [book], 5));
  expect(addSourceAt(v, draft, NEW, true)).toBe("ok");
  const result = tiptapToCanonicalV2(v.state.doc.toJSON());
  expect(JSON.stringify(result)).toContain(NEW);
  expect((v.state.doc.attrs.sources as { id: string }[]).map((s) => s.id)).toEqual([ID, NEW]);
  let citations = 0;
  v.state.doc.descendants((n) => { if (n.type.name === "citation") citations += 1; });
  expect(citations).toBe(1);
});

it("adds only to the list for 'Samo u Literaturu'", () => {
  const v = view(stateWith("Tekst.", []));
  expect(addSourceAt(v, draft, NEW, false)).toBe("ok");
  let citations = 0;
  v.state.doc.descendants((n) => { if (n.type.name === "citation") citations += 1; });
  expect(citations).toBe(0);
});

it("refuses a source beyond the limit of the document", () => {
  const many = Array.from({ length: 500 }, (_, i) => ({ ...book, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
  expect(addSourceTransaction(stateWith("x", many), draft, NEW)).toBe("limit");
});

it("finds the '[izvor]' marks in text order and walks to the next one, wrapping", () => {
  const state = stateWith("Prvo [izvor] pa [izvor] kraj.");
  const places = plainCitationPlaces(state.doc);
  expect(places).toEqual([6, 17]);
  expect(nextPlace(places, 1)).toBe(6);
  expect(nextPlace(places, 6)).toBe(17);
  expect(nextPlace(places, 17)).toBe(6);
  expect(nextPlace([], 3)).toBeNull();
});

describe("listedSources", () => {
  const id1 = "11111111-1111-4111-8111-111111111111";
  const id2 = "22222222-2222-4222-8222-222222222222";
  const doc = {
    attrs: { sources: [
      { id: id1, title: "Izmišljena knjiga", year: 2020, authors: [{ kind: "person", family: "Horvat" }] },
      { id: id2, title: "Drugi izmišljeni članak", year: 2021, authors: [{ kind: "person", family: "Kovač" }] },
    ] },
    content: [{ type: "paragraph", content: [{ type: "citation", attrs: { sourceId: id1, locator: "3" } }] }],
  };
  it("marks which sources are cited", () => {
    expect(listedSources(doc)).toEqual([
      { id: id1, entry: "Horvat (2020). Izmišljena knjiga", cited: true },
      { id: id2, entry: "Kovač (2021). Drugi izmišljeni članak", cited: false },
    ]);
  });
  it("is empty without sources", () => expect(listedSources(null)).toEqual([]));
});
