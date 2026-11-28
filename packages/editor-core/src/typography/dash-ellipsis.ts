/**
 * ED-48 (P2-24): the dash and the ellipsis while typing, as the prototype's
 * typography (acad.js §4) and beside the Croatian quotes (croatian-quotes.ts):
 *   - a hyphen between two spaces becomes the en dash: "a - " → "a – ";
 *   - three full stops become the ellipsis: "..." → "…".
 *
 * A hyphen inside a word ("crno-bijeli") or at the start of a block (a list's
 * own input rule) is left alone. As with the quotes, Tiptap runs no input rule
 * in code, and paste or drop never reach one. The conversion is a second
 * transaction after the typed key, recorded as `unattributed`; Undo or
 * Backspace right after it gives the typed characters back (`undoInputRule`).
 */

import { Extension, InputRule } from "@tiptap/core";

import { typingTypographyOn } from "./typing-switch";

export const EN_DASH = "–";
export const ELLIPSIS = "…";

/** What replaces the end of `typed` (the block's text up to and with the typed key), or null. */
export function dashOrEllipsis(typed: string): { readonly length: number; readonly text: string } | null {
  const dash = /(\s)-\s$/u.exec(typed);
  if (dash) return { length: 2, text: `${EN_DASH} ` };
  if (typed.endsWith("...")) return { length: 3, text: ELLIPSIS };
  return null;
}

export const DashEllipsis = Extension.create({
  name: "dashEllipsis",

  addInputRules() {
    const rule = (find: RegExp) => new InputRule({
      find,
      handler: ({ state, range, match }) => {
        // ED-99: "Tipografija dok tipkam" switched off leaves the typed characters.
        if (!typingTypographyOn()) return null;
        const swap = dashOrEllipsis(match[0]);
        if (swap === null) return null;
        state.tr.insertText(swap.text, range.to - swap.length, range.to);
        return undefined;
      },
    });
    return [rule(/\s-\s$/u), rule(/\.\.\.$/u)];
  },
});
