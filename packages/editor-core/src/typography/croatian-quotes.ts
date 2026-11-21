/**
 * Croatian quotation marks while typing (WEB-1605, M5.10, DAN-409): a
 * straight `"` becomes „ or ”, and a straight `'` becomes ‚ or ’ inside an
 * open „…”. The pairs are the ones the manual text fix "quotes" writes
 * (src/components/editor/text-fixes/fixes.ts).
 *
 * The rule only looks at the text before the caret in the same block:
 *   - `"` closes with ” when a „ is open, and opens with „ at the start of
 *     the block or after a space or an opening mark;
 *   - `'` opens with ‚ inside an open „ at the same places, and closes with ’
 *     when a ‚ is open;
 *   - anything else stays straight, so an apostrophe or the inch sign after
 *     a letter or a digit is never changed.
 *
 * Code is left alone: Tiptap runs no input rule in a node whose spec says
 * `code: true` (the code block, extensions-v4.ts). Paste, drop and the
 * browser's autocorrect never reach an input rule, so their text keeps its
 * straight marks.
 *
 * Evidence (source.ts, Q1): Tiptap first dispatches the typed `"` as its
 * own transaction, recorded as `editor`, then the conversion as a second
 * one. The conversion inserts a character other than the key, so it is
 * recorded as `unattributed`, like the manual quotes fix and find and
 * replace. source.ts is not changed here. Undo and Backspace right after the
 * conversion give the straight quote back (Tiptap `undoInputRule`).
 */

import { Extension, InputRule } from "@tiptap/core";

export const LOW_DOUBLE = "„";
export const HIGH_DOUBLE = "”";
export const LOW_SINGLE = "‚";
export const HIGH_SINGLE = "’";

/** Characters after which a typed quote opens: none (block start), a space, or an opening mark. */
const OPENS_AFTER = /^$|[\s([{„‚–—-]$/u;

function isOpen(text: string, opening: string, closing: string): boolean {
  return text.lastIndexOf(opening) > text.lastIndexOf(closing);
}

/**
 * The mark that replaces a typed straight quote, given the text before the
 * caret in its block, or null when it stays straight.
 */
export function croatianQuote(before: string, typed: string): string | null {
  const opens = OPENS_AFTER.test(before);
  if (typed === '"') {
    if (isOpen(before, LOW_DOUBLE, HIGH_DOUBLE)) return HIGH_DOUBLE;
    return opens ? LOW_DOUBLE : null;
  }
  if (typed === "'") {
    const inner = before.slice(before.lastIndexOf(LOW_DOUBLE) + 1);
    if (!isOpen(before, LOW_DOUBLE, HIGH_DOUBLE)) return null;
    if (isOpen(inner, LOW_SINGLE, HIGH_SINGLE)) return opens ? null : HIGH_SINGLE;
    return opens ? LOW_SINGLE : null;
  }
  return null;
}

/** The typed quote at the end of the text before the caret (Tiptap appends the typed text). */
const TYPED_QUOTE = /["']$/u;

export const CroatianQuotes = Extension.create({
  name: "croatianQuotes",

  addInputRules() {
    return [
      new InputRule({
        find: TYPED_QUOTE,
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from);
          const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
          const mark = croatianQuote(before, match[0]);
          if (mark === null) return null;
          state.tr.insertText(mark, range.from, range.to);
          return undefined;
        },
      }),
    ];
  },
});
