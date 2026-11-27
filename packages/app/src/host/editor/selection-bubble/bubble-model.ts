// ED-109: the bubble beside a selection in the text (prototype #selBub, toolbar2; INVENTAR "Balončić uz označeni
// tekst"). It shows 350 ms after the selection settles, when the work is writable and the selection holds at least
// three characters without the spaces around them. Only actions this editor has are offered: Navod, U blok-citat,
// U fusnotu and Odloži. Komentar, Marker and Pomoćnik have no action in the student's editor yet, so they are not shown.
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

import { insertAcademicAtom } from "@/components/editor/footnotes/inline-atoms";
import { footnoteText } from "@/components/editor/footnotes/footnote-text";

import { parseStash, stashAdd, storageKey, writeJson, readJson, type Store } from "../left/left-model";

export const BUBBLE_DELAY_MS = 350;
export const MIN_SELECTED = 3;

export type BubbleAction = "cite" | "toQuote" | "toFootnote" | "stash";

/** The selected text, or null when the bubble has no reason to show. */
export function bubbleText(state: EditorState): string | null {
  const { selection, doc } = state;
  if (!(selection instanceof TextSelection) || selection.empty) return null;
  const text = doc.textBetween(selection.from, selection.to, "\n").trim();
  return text.length >= MIN_SELECTED ? text : null;
}

/** Where the bubble stands: centred above the selection, or under it on a low screen or near the top. */
export function bubblePlace(rect: { top: number; bottom: number; left: number; right: number }, viewport: { width: number; height: number }) {
  const below = viewport.height <= 700 || rect.top < 110;
  const top = below ? Math.min(rect.bottom + 10, viewport.height - 100) : rect.top - 44;
  const left = Math.min(Math.max((rect.left + rect.right) / 2, 16), Math.max(viewport.width - 16, 16));
  return { top, left, below };
}

/** U fusnotu: the selected words leave the text and become a footnote in their place (v3 only, one paragraph). */
export function selectionToFootnote(state: EditorState, version: number | undefined): Transaction | null {
  const { selection, doc } = state;
  if (selection.empty) return null;
  const text = footnoteText(doc.textBetween(selection.from, selection.to, " "));
  if (!text) return null;
  return insertAcademicAtom(state, version, "footnote", { text });
}

/** Navod: the caret goes to the end of the selection, where the citation will stand. */
export function caretToEnd(state: EditorState): Transaction {
  return state.tr.setSelection(TextSelection.create(state.doc, state.selection.to));
}

/** Odloži: keeps the text under "Odloženo" in the left panel, on this device. False when the browser refuses. */
export function stashText(store: Store | null, workId: string, text: string, id: string, at: string): boolean {
  const key = storageKey("stash", workId);
  const items = readJson(store, key, parseStash, []);
  return writeJson(store, key, stashAdd(items, text, id, at));
}
