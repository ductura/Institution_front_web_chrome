import type { SourceDraft } from "@ductura/ui";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

import { citationRange, insertCitation } from "@/components/editor/citations/citation-document";
import { documentCitations, documentSources, sourceLabel } from "@/components/editor/sources/proofs/proof-sources";
import type { Source } from "@/components/editor/triggers/items";
import { MAX_DOCUMENT_SOURCES } from "@/domain/document/schema";

/** What the "@" menu needs of one note of a source: only a note with a page can become a citation. */
export type MentionNote = { readonly sourceId: string; readonly id: string; readonly page: string | null; readonly text: string };

/** The sources of the open document for the "@" menu, in document order (D§2.1): label "Autor (godina)", title, search words. */
export function mentionSources(sources: unknown, notes: readonly MentionNote[] = []): Source[] {
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((raw): Source[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const source = raw as Record<string, unknown>;
    if (typeof source.id !== "string" || typeof source.title !== "string") return [];
    const own = notes.filter((note) => note.sourceId === source.id && note.page?.trim());
    return [{
      id: source.id, label: sourceLabel(source), title: source.title, search: source.title,
      notes: own.map((note) => ({ id: note.id, page: note.page!.trim(), text: note.text })),
    }];
  });
}

/** The places of "[izvor]" (a citation left for later, E§2.2 "/izvor"), in text order; each is the start of the marker. */
export function plainCitationPlaces(doc: EditorState["doc"]): number[] {
  const places: number[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, "\n", "￼");
    // textBetween keeps one position per character, so the offset in the text is the offset in the block.
    for (const match of text.matchAll(/\[izvor\]/g)) places.push(pos + 1 + match.index);
    return false;
  });
  return places;
}

/** The next place after the cursor, wrapping to the first; null when there is none. */
export function nextPlace(places: readonly number[], cursor: number): number | null {
  return places.find((place) => place > cursor) ?? places[0] ?? null;
}

/** Appends a new source to the document (docAttr "sources") and tells whether the limit stopped it. */
export function addSourceTransaction(state: EditorState, draft: SourceDraft, id: string): Transaction | "limit" {
  const sources: unknown = state.doc.attrs.sources;
  const list = Array.isArray(sources) ? sources : [];
  if (list.length >= MAX_DOCUMENT_SOURCES) return "limit";
  return state.tr.setDocAttribute("sources", [...list, { id, ...draft }]);
}

/**
 * Adds the source to the work; with `cite` the citation goes at the cursor in a second step,
 * once the source is in the document. False when nothing could be written.
 */
export function addSourceAt(
  view: { state: EditorState; dispatch: (tr: Transaction) => void },
  draft: SourceDraft, id: string, cite: boolean,
): "ok" | "limit" | "failed" {
  const added = addSourceTransaction(view.state, draft, id);
  if (added === "limit") return "limit";
  view.dispatch(added);
  if (!cite) return "ok";
  const range = citationRange(view.state);
  const tr = range && insertCitation(view.state, range, id, "");
  if (!tr) return "failed";
  view.dispatch(tr);
  return "ok";
}

export function jumpTo(state: EditorState, pos: number): Transaction {
  return state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))).scrollIntoView();
}

/** The sources of the work as entries "Autor (godina). Naslov" with whether any citation points at them (Literatura list). */
export function listedSources(doc: Parameters<typeof documentSources>[0]): { id: string; entry: string; cited: boolean }[] {
  const cited = new Set(documentCitations(doc).map((c) => c.sourceId));
  const titles = new Map<string, string>();
  const list = doc?.attrs?.sources;
  if (Array.isArray(list)) for (const raw of list) {
    const s = raw as Record<string, unknown> | null;
    if (s && typeof s.id === "string" && typeof s.title === "string") titles.set(s.id, s.title);
  }
  return documentSources(doc).map(({ id, label }) => ({ id, entry: `${label}. ${titles.get(id) ?? ""}`.trim(), cited: cited.has(id) }));
}
