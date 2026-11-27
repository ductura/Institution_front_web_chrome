// ED-108: "Zalijepljeno. Što je ovo?" after a paste (prototype toolbar2.js `X.hooks.paste`, features.js
// `pasteQuote`, `stash`, toolbar2.js `tbPasteNote`). The pasted range is read from where the selection
// started before the paste to where it ends after it; the offer works on that range only while the text
// is unchanged. Nothing here makes a network call or touches the schema: quotes are text, the stash and
// the source note live where they already live.
import { TextSelection, type EditorState } from "@tiptap/pm/state";

import { parseStash, readJson, stashAdd, storageKey, writeJson, type StashItem } from "../left/left-model";

/** A paste shorter than this is a word or two, not a passage worth asking about. */
export const MIN_PASTE_WORDS = 3;

export type PastedRange = { readonly from: number; readonly to: number };

export const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

/** The pasted range in one text block, or null: a paste across blocks or into nothing is not asked about. */
export function pastedRange(state: EditorState, before: number): PastedRange | null {
  const to = state.selection.from;
  if (before < 0 || to <= before || to > state.doc.content.size) return null;
  const $from = state.doc.resolve(before);
  const $to = state.doc.resolve(to);
  return $from.sameParent($to) && $from.parent.isTextblock ? { from: before, to } : null;
}

export const pastedText = (state: EditorState, range: PastedRange): string => state.doc.textBetween(range.from, range.to, " ");

/** "Doslovni navod": Croatian quotes around the paste, the cursor right after the closing one. */
export function quotePasted(state: EditorState, range: PastedRange) {
  const tr = state.tr.insertText("”", range.to).insertText("„", range.from);
  return tr.setSelection(TextSelection.create(tr.doc, range.to + 2));
}

/** The paste taken out of the text ("Odloži za poslije", "Bilješka uz izvor"). */
export const removePasted = (state: EditorState, range: PastedRange) => state.tr.delete(range.from, range.to);

type Store = Parameters<typeof writeJson>[0];

/** Puts `text` at the top of the work's stash on this device, as the left panel's "Odloženo" does. */
export function stashText(store: Store | null, workId: string, text: string, id: string, at: string): StashItem[] | null {
  const key = storageKey("stash", workId);
  const items = stashAdd(readJson(store, key, parseStash, []), text, id, at);
  return writeJson(store, key, items) ? items : null;
}
