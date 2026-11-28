// ED-76: "Prepoznat izvor" on paste (prototype features.js `X.hooks.paste`, `pasteCite`). When the
// pasted text holds the start of a quote the student wrote down in the source notebook, the editor
// offers the citation of that source with the note's page. The paste itself is left as it is: its
// provenance is the editor's, not this offer's. Nothing here makes a network call.
import { TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";

import { citationRange, insertCitation, validCitationPage } from "@/components/editor/citations/citation-document";

import type { NotebookEntry } from "../source-notebook/notebook";

/** A paste shorter than this is a word or a phrase, not a passage from a source. */
export const MIN_WORDS = 8;
/** The quote must be this long to be recognised, and this much of its start is looked for. */
const MIN_QUOTE = 21;
const KEY = 40;

export const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

/** Lines broken as in a PDF (a hyphen before a lower-case letter joins the word), spaces folded, lower case. */
export function normal(text: string): string {
  return text.replace(/-\r?\n(?=\p{Ll})/gu, "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("hr");
}

export type Recognised = { readonly sourceId: string; readonly label: string; readonly page: string };

/** The note whose quote the paste holds; the last one of the notebook wins, as in the prototype. */
export function recognizePaste(entries: readonly NotebookEntry[], pasted: string): Recognised | null {
  if (wordCount(pasted) < MIN_WORDS) return null;
  const text = normal(pasted);
  let found: Recognised | null = null;
  for (const entry of entries) {
    const quote = normal(entry.quote ?? "");
    if (quote.length < MIN_QUOTE || !text.includes(quote.slice(0, KEY))) continue;
    const page = entry.page?.trim() ?? "";
    found = { sourceId: entry.source.id, label: entry.source.label, page: validCitationPage(page) ? page : "" };
  }
  return found;
}

/** The citation of the recognised source right after the pasted text, or null when it cannot stand there. */
export function citeAfterPaste(state: EditorState, at: number, found: Recognised) {
  if (at < 0 || at > state.doc.content.size) return null;
  const placed = state.apply(state.tr.setSelection(TextSelection.create(state.doc, at)));
  const range = citationRange(placed);
  if (!range) return null;
  const tr = insertCitation(placed, range, found.sourceId, found.page);
  return tr;
}
