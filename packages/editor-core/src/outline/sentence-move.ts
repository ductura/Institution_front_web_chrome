/**
 * ED-33 (P2-2): Alt+↑/↓ swaps the sentence holding the cursor with the one before or after it, inside the
 * same paragraph (the prototype's moveSentence, features.js). The plan is pure text arithmetic; the editor
 * part swaps the inline content of the two sentences in one replace inside the paragraph, so the paragraph
 * keeps its block id and every mark and inline atom moves with its sentence.
 */

import { Extension, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

import type { MoveDirection } from "./move";

/** A sentence as offsets into its paragraph's text: [from, to) without the spaces around it. */
export type SentenceSpan = { readonly from: number; readonly to: number };

/** Text up to an end mark and its closing quotes or bracket, or up to the end of the paragraph. */
const SENTENCE = /[^.!?…]+(?:[.!?…]+[”"»)]*|$)/gu;

/** The sentences of a paragraph's text (inline atoms count as one character each). */
export function sentenceSpans(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  for (const m of text.matchAll(SENTENCE)) {
    const raw = m[0];
    if (raw.trim() === "") continue;
    const from = m.index + (raw.length - raw.trimStart().length);
    out.push({ from, to: m.index + raw.trimEnd().length });
  }
  return out;
}

/** Why a sentence does not move; the host may say it. */
export type SentenceMoveRefusal = "one-sentence" | "first" | "last" | "outside";

/** The two sentences to swap (first before second in the text), or why there is nothing to swap. */
export type SentenceMovePlan =
  | { readonly ok: true; readonly first: SentenceSpan; readonly second: SentenceSpan; readonly moving: "first" | "second" }
  | { readonly ok: false; readonly reason: SentenceMoveRefusal };

/** Plans the move of the sentence holding `offset` (the cursor's offset in the paragraph's text). */
export function planSentenceMove(text: string, offset: number, direction: MoveDirection): SentenceMovePlan {
  const spans = sentenceSpans(text);
  if (spans.length < 2) return { ok: false, reason: "one-sentence" };
  const i = spans.findIndex((s) => offset >= s.from && offset <= s.to);
  if (i < 0) return { ok: false, reason: "outside" };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0) return { ok: false, reason: "first" };
  if (j >= spans.length) return { ok: false, reason: "last" };
  const [a, b] = i < j ? [i, j] : [j, i];
  return { ok: true, first: spans[a]!, second: spans[b]!, moving: i < j ? "first" : "second" };
}

/** The text of a paragraph as the plan reads it: one character for each inline atom. */
const ATOM = "￼";

/** Moves the sentence holding the cursor; false when it cannot (not in a paragraph, read-only, no neighbour). */
export function moveSentenceInEditor(editor: Editor, direction: MoveDirection): boolean {
  if (editor.view.isDestroyed === true || !editor.isEditable) return false;
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "paragraph") return false;
  const paragraph = $from.parent;
  const start = $from.start();
  const text = paragraph.textBetween(0, paragraph.content.size, undefined, ATOM);
  const plan = planSentenceMove(text, $from.parentOffset, direction);
  if (!plan.ok) return false;
  const { first, second } = plan;
  const slice = (from: number, to: number) => state.doc.slice(start + from, start + to).content;
  // second + the space between + first, in place of first … second.
  const swapped = slice(second.from, second.to).append(slice(first.to, second.from)).append(slice(first.from, first.to));
  const tr = state.tr.replaceWith(start + first.from, start + second.to, swapped);
  // The cursor stays at the start of the sentence that moved.
  const movedStart = plan.moving === "second" ? first.from : first.from + (second.to - second.from) + (second.from - first.to);
  tr.setSelection(TextSelection.create(tr.doc, start + movedStart));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Alt+↑/↓ moves the sentence holding the cursor within its paragraph (prototype, Više → Rečenica gore/dolje). */
export const SentenceMove = Extension.create({
  name: "sentenceMove",
  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => moveSentenceInEditor(this.editor, "up"),
      "Alt-ArrowDown": () => moveSentenceInEditor(this.editor, "down"),
    };
  },
});
