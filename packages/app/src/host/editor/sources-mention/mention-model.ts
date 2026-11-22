import type { SourceDraft } from "@ductura/ui";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

import { citationRange, insertCitation } from "@/components/editor/citations/citation-document";
import { documentCitations, documentSources, sourceLabel } from "@/components/editor/sources/proofs/proof-sources";
import type { Source } from "@/components/editor/triggers/items";
import { MAX_DOCUMENT_SOURCES } from "@/domain/document/schema";
import { plainCitePlaces } from "../marks/marks-model";

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

/** One place of a citation without a source: a "[izvor]" marker (can be linked or filled) or a citation typed as text, "(Autor, 2020)" (only shown). */
export type UnsourcedPlace = { readonly pos: number; readonly marker: boolean };

/** The same marks as the text marks of MarksHost (one source of truth for the counter): "[izvor]" markers and typed citations, in text order. */
export function unsourcedCitationPlaces(doc: EditorState["doc"]): UnsourcedPlace[] {
  const typed = plainCitePlaces(doc).map((p): UnsourcedPlace => ({ pos: p.from, marker: false }));
  return [...plainCitationPlaces(doc).map((pos): UnsourcedPlace => ({ pos, marker: true })), ...typed].sort((a, b) => a.pos - b.pos);
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

const PLAIN = "[izvor]";

/** The text around a "[izvor]" place, for the card in the list (about 60 characters, on one line). */
export function placeExcerpt(doc: EditorState["doc"], pos: number): string {
  const $pos = doc.resolve(pos);
  const block = $pos.parent;
  const start = $pos.start();
  const text = block.textBetween(0, block.content.size, " ", " ");
  const at = pos - start;
  const before = text.slice(Math.max(0, at - 40), at);
  const after = text.slice(at, at + PLAIN.length + 20);
  return `${at > 40 ? "…" : ""}${before}${after}${at + PLAIN.length + 20 < text.length ? "…" : ""}`.replace(/\s+/g, " ").trim();
}

/** Replaces the "[izvor]" at `pos` with a citation of the source; null when the place or the source is no longer there. */
export function linkPlaceTransaction(state: EditorState, pos: number, sourceId: string): Transaction | null {
  const type = state.schema.nodes.citation;
  const sources: unknown = state.doc.attrs.sources;
  if (!type || !Array.isArray(sources) || !sources.some((s) => (s as { id?: unknown } | null)?.id === sourceId)) return null;
  if (pos < 0 || pos + PLAIN.length > state.doc.content.size) return null;
  if (state.doc.textBetween(pos, pos + PLAIN.length) !== PLAIN) return null;
  const $from = state.doc.resolve(pos);
  const $to = state.doc.resolve(pos + PLAIN.length);
  if (!$from.sameParent($to) || !$from.parent.canReplaceWith($from.index(), $to.index(), type)) return null;
  const tr = state.tr.replaceWith(pos, pos + PLAIN.length, type.create({ sourceId, locator: null }));
  return tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))).scrollIntoView();
}

/** How many citations of the work point at the source. */
export function citationCount(doc: EditorState["doc"], sourceId: string): number {
  let count = 0;
  doc.descendants((node) => { if (node.type.name === "citation" && node.attrs.sourceId === sourceId) count += 1; });
  return count;
}

/**
 * Removes the source from the work (prototype `srcDel`): every citation of it becomes "[izvor]",
 * so the place stays visible for checking. Null when the source is not in the work.
 */
export function removeSourceTransaction(state: EditorState, sourceId: string): Transaction | null {
  const sources: unknown = state.doc.attrs.sources;
  if (!Array.isArray(sources) || !sources.some((s) => (s as { id?: unknown } | null)?.id === sourceId)) return null;
  const places: number[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === "citation" && node.attrs.sourceId === sourceId) places.push(pos);
  });
  const tr = state.tr;
  // From the end, so the earlier positions stay valid.
  for (const pos of places.reverse()) tr.replaceWith(pos, pos + 1, state.schema.text(PLAIN));
  return tr.setDocAttribute("sources", sources.filter((s) => (s as { id?: unknown } | null)?.id !== sourceId));
}

/** The stored source as a draft for the form "Uredi izvor"; null for a record the form cannot show. */
export function sourceDraftOf(sources: unknown, sourceId: string): SourceDraft | null {
  if (!Array.isArray(sources)) return null;
  const raw = sources.find((s) => (s as { id?: unknown } | null)?.id === sourceId) as Record<string, unknown> | undefined;
  if (!raw || typeof raw.type !== "string" || typeof raw.title !== "string" || !Array.isArray(raw.authors)) return null;
  const { id: _id, ...draft } = raw;
  return draft as SourceDraft;
}

/** Writes the edited source in place of the old one; the id and the citations stay. */
export function editSourceTransaction(state: EditorState, sourceId: string, draft: SourceDraft): Transaction | null {
  const sources: unknown = state.doc.attrs.sources;
  if (!Array.isArray(sources) || !sources.some((s) => (s as { id?: unknown } | null)?.id === sourceId)) return null;
  return state.tr.setDocAttribute("sources", sources.map((s) =>
    (s as { id?: unknown } | null)?.id === sourceId ? { id: sourceId, ...draft } : s));
}
