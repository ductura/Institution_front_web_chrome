/**
 * ED-33 (P2-2): Alt+↑/↓ swaps the sentence holding the cursor with the one before or after it, inside the
 * same paragraph (the prototype's moveSentence, features.js). The plan is pure text arithmetic; the editor
 * part swaps the inline content of the two sentences in one replace inside the paragraph, so the paragraph
 * keeps its block id and every mark and inline atom moves with its sentence.
 */

import { Extension, type Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

import type { MoveDirection } from "./move";

/** A sentence as offsets into its paragraph's text: [from, to) without the spaces around it. */
export type SentenceSpan = { readonly from: number; readonly to: number };

/** The text of a paragraph as the plan reads it: one character for each inline atom. */
const ATOM = "\uFFFC";
const MOVE_HISTORY = new PluginKey("sentenceMoveHistory");

const END_MARK = /[.!?…]+[“”"‘’'«»)\]}]*(?:\uFFFC+[.!?…]*)?/gu;
const NUMBER_DATE = /(?<![\p{L}\d])\d{1,2}\.[^\S\r\n]*\d{1,2}\.[^\S\r\n]*\d{4}(?!\d)/gu;
const WRITTEN_DATE = /(?<![\p{L}\d])\d{1,2}\.(?=[^\S\r\n]+(?:siječnja|veljače|ožujka|travnja|svibnja|lipnja|srpnja|kolovoza|rujna|listopada|studenoga|studenog|prosinca)(?!\p{L}))/giu;
const SHORT_DATE = /(?<![\p{L}\d])\d{1,2}\.[^\S\r\n]+(?:sij|velj|ožu|tra|svi|lip|srp|kol|ruj|lis|stu|pro)\.[^\S\r\n]+\d{4}(?!\d)/giu;
const DOTTED_FORM = /(?<![\p{L}\d])(?:d\.[^\S\r\n]*o\.[^\S\r\n]*o\.|p\.[^\S\r\n]*n\.[^\S\r\n]*e\.|pr\.[^\S\r\n]*Kr\.)/giu;

// Titles and introductory abbreviations can be followed by an uppercase word.
const PREFIX = new Set(["npr", "tj", "tzv", "odn", "usp", "prof", "dr", "doc", "mr", "sc", "dipl", "ing"]);
const NUMBER_PREFIX = new Set(["str", "br", "čl", "st", "toč", "sl", "tab", "sv", "god"]);
const OPTIONAL_END = new Set(["itd", "itp", "sl", "dr", "sur", "al", "etc", "ibid", "god", "g"]);
const INITIAL = /^(?:\p{Lu}|Lj|Nj|Dž)$/u;
const NAME_OR_INITIAL = /^(?:\p{Lu}[\p{L}\p{M}]+|\p{Lu}\.)/u;
const CONTINUATION = /^[\p{Ll},;:]/u;
const CLOSE_QUOTE = /[“”"‘’'«»]/u;
const ORDINAL_CONTEXT = /^(?:(?:čl|st|toč)\.|(?:godine|stoljeća|poglavlje|izdanje)(?!\p{L}))/iu;
const NUMBERED_REFERENCE = /(?:^|[^\p{L}])(?:čl|st|toč)\.[^\S\r\n]+\d+$/iu;
const CITATION = /(?:\((?=[^()[\]\r\n]*\p{L})[^()[\]\r\n]*?[,\s]\d{4}[a-z]?(?!\d)[^()[\]\r\n]*\)|\[\d+(?:[^\S\r\n]*[,–-][^\S\r\n]*\d+)*\])([.!?…]*)/gu;

function punctuationContext(text: string) {
  const internal = new Set<number>();
  const abbreviationEnds = new Set<number>();
  const citations = new Map<number, { to: number; hasEndMark: boolean }>();
  for (const pattern of [NUMBER_DATE, WRITTEN_DATE, SHORT_DATE, DOTTED_FORM]) {
    for (const match of text.matchAll(pattern)) {
      for (const dot of match[0].matchAll(/\./g)) {
        const set = pattern === DOTTED_FORM && dot.index === match[0].length - 1 ? abbreviationEnds : internal;
        set.add(match.index + dot.index);
      }
    }
  }
  for (const match of text.matchAll(CITATION)) {
    const ending = match[1] ?? "";
    const reference = match[0].slice(0, match[0].length - ending.length);
    for (const mark of reference.matchAll(/[.!?…]/gu)) internal.add(match.index + mark.index);
    citations.set(match.index, { to: match.index + match[0].length, hasEndMark: ending !== "" });
  }
  return { internal, abbreviationEnds, citations };
}

function continuesAfterPeriod(text: string, index: number, start: number, next: string): boolean {
  const before = text.slice(Math.max(start, index - 24), index);
  if (/\d$/.test(before)) {
    if (/^\d/.test(text.slice(index + 1, index + 2))) return true;
    // A year has a period in running Croatian prose as well as at sentence end.
    return ORDINAL_CONTEXT.test(next) ||
      (CONTINUATION.test(next) && (/(?:^|\D)\d{4}$/.test(before) || NUMBERED_REFERENCE.test(before)));
  }
  const word = before.match(/[\p{L}\p{M}]+$/u)?.[0] ?? "";
  const lower = word.toLowerCase();
  if (NUMBER_PREFIX.has(lower) && /^\d/.test(next)) return true;
  if (OPTIONAL_END.has(lower) && CONTINUATION.test(next)) return true;
  if ((lower === "sur" || lower === "al") && /^\(\d{4}[a-z]?(?:\)|[,;:])/u.test(next)) return true;
  if (lower === "dr" && /(?:^|[^\p{L}])i[^\S\r\n]+dr$/iu.test(before)) return false;
  if (PREFIX.has(lower) && /^[\p{L}\d(„“«"]/u.test(next)) return true;
  return INITIAL.test(word) && NAME_OR_INITIAL.test(next);
}

/** UTF-16 ranges into the unmodified paragraph projection. */
export function sentenceSpans(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const { internal, abbreviationEnds, citations } = punctuationContext(text);
  const horizontalSpace = /[^\S\r\n]*/y;
  let start = 0;
  let consumedThrough = 0;
  const emit = (end: number) => {
    const raw = text.slice(start, end);
    if (!/[^.!?…\s]/u.test(raw)) return;
    out.push({ from: start + raw.length - raw.trimStart().length, to: start + raw.trimEnd().length });
    start = end;
  };

  for (const mark of text.matchAll(END_MARK)) {
    if (mark.index < consumedThrough || internal.has(mark.index)) continue;
    const raw = mark[0];
    const end = mark.index + raw.length;
    horizontalSpace.lastIndex = end;
    horizontalSpace.exec(text);
    const nextIndex = horizontalSpace.lastIndex;
    const next = text.slice(nextIndex, nextIndex + 16);
    if (raw === "." && (
      (abbreviationEnds.has(mark.index) && /^[\p{Ll}\d,;:]/u.test(next)) ||
      continuesAfterPeriod(text, mark.index, start, next)
    )) continue;

    const citation = citations.get(nextIndex);
    if (citation) {
      consumedThrough = citation.to;
      horizontalSpace.lastIndex = consumedThrough;
      horizontalSpace.exec(text);
      const following = horizontalSpace.lastIndex;
      if (!citation.hasEndMark && CONTINUATION.test(text.slice(following, following + 1))) continue;
      emit(consumedThrough);
      continue;
    }
    // The reporting clause after a quotation can still belong to that sentence.
    if (CLOSE_QUOTE.test(raw) && CONTINUATION.test(next)) continue;
    emit(end);
  }
  emit(text.length);
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
  const tr = closeHistory(state.tr.replaceWith(start + first.from, start + second.to, swapped));
  tr.setMeta(MOVE_HISTORY, true);
  // The cursor stays at the start of the sentence that moved.
  const movedStart = plan.moving === "second" ? first.from : first.from + (second.to - second.from) + (second.from - first.to);
  tr.setSelection(TextSelection.create(tr.doc, start + movedStart));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Alt+↑/↓ moves the sentence holding the cursor within its paragraph (prototype, Više → Rečenica gore/dolje). */
export const SentenceMove = Extension.create({
  name: "sentenceMove",
  addProseMirrorPlugins() {
    return [new Plugin({
      key: MOVE_HISTORY,
      appendTransaction(transactions, _oldState, newState) {
        // As with FindReplaceHistory, typing after the move gets its own undo step.
        return transactions.some((tr) => tr.docChanged && tr.getMeta(MOVE_HISTORY) === true)
          ? closeHistory(newState.tr)
          : null;
      },
    })];
  },
  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => moveSentenceInEditor(this.editor, "up"),
      "Alt-ArrowDown": () => moveSentenceInEditor(this.editor, "down"),
    };
  },
});
