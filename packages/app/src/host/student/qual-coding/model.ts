// WEB-V18-KODIRANJE-OZNAKE: the pure rules of the coding page: the input checks the server also makes
// (val18-razlika V18-8 and SRV-V18-KODIRANJE-BAZA), the anchor of a selected passage, and the order of what is shown.
// The order is the codebook's, then the passage's place in the text; never by a count (V18-8).
import type { Anchor, Code, Segment } from "./read";

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 500;
export const MAX_CODES = 100;
export const MAX_QUOTE = 500;
export const MAX_MEMO = 1000;

// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F‎‏؜‪-‮⁦-⁩]/;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_MULTILINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏؜‪-‮⁦-⁩]/;

export type CodeDraft = { readonly name: string; readonly description: string };
export type CodeError = "nameRequired" | "nameTooLong" | "nameInvalid" | "nameTaken" | "descriptionTooLong" | "descriptionInvalid" | "full";
export type CheckedCode =
  | { readonly ok: true; readonly value: { readonly name: string; readonly description?: string } }
  | { readonly ok: false; readonly field: "name" | "description" | "form"; readonly error: CodeError };

const same = (a: string, b: string) => a.toLocaleLowerCase("hr") === b.toLocaleLowerCase("hr");

/** `codes` is the codebook now; `selfId` is the code being renamed, which may keep its own name. */
export function checkCode(draft: CodeDraft, codes: readonly Code[], selfId?: string): CheckedCode {
  if (selfId === undefined && codes.length >= MAX_CODES) return { ok: false, field: "form", error: "full" };
  const name = draft.name.normalize("NFC").trim();
  if (name === "") return { ok: false, field: "name", error: "nameRequired" };
  if ([...name].length > MAX_NAME) return { ok: false, field: "name", error: "nameTooLong" };
  if (FORBIDDEN.test(name)) return { ok: false, field: "name", error: "nameInvalid" };
  if (codes.some((c) => c.id !== selfId && same(c.name, name))) return { ok: false, field: "name", error: "nameTaken" };
  const description = draft.description.normalize("NFC").trim();
  if ([...description].length > MAX_DESCRIPTION) return { ok: false, field: "description", error: "descriptionTooLong" };
  if (FORBIDDEN_MULTILINE.test(description)) return { ok: false, field: "description", error: "descriptionInvalid" };
  return { ok: true, value: description === "" ? { name } : { name, description } };
}

export type MarkError = "noCode" | "noSelection" | "quoteTooLong" | "memoTooLong" | "memoInvalid" | "unsupportedText";
export type Selection = { readonly paragraph: number; readonly start: number; readonly end: number };
export type CheckedMark =
  | { readonly ok: true; readonly anchor: Anchor; readonly memo?: string }
  | { readonly ok: false; readonly error: MarkError };

/** A paragraph with a character outside the basic plane has offsets that count differently by code unit and by code point: it is not marked. */
const hasAstral = (line: string) => /[\uD800-\uDFFF]/.test(line);

/**
 * The anchor of a selected passage: the paragraph (line index of the text, an empty line counts), the offsets in it and
 * the exact quote. The quote is cut from the text itself, so it always agrees with the text the server holds.
 */
export function checkMark(lines: readonly string[], codeId: string, selection: Selection | null, memoText: string): CheckedMark {
  if (codeId === "") return { ok: false, error: "noCode" };
  if (selection === null) return { ok: false, error: "noSelection" };
  const line = lines[selection.paragraph];
  if (line === undefined || selection.start < 0 || selection.end > line.length || selection.end <= selection.start) return { ok: false, error: "noSelection" };
  if (hasAstral(line)) return { ok: false, error: "unsupportedText" };
  const quote = line.slice(selection.start, selection.end);
  if (quote.trim() === "") return { ok: false, error: "noSelection" };
  if ([...quote].length > MAX_QUOTE) return { ok: false, error: "quoteTooLong" };
  const memo = memoText.normalize("NFC").trim();
  if ([...memo].length > MAX_MEMO) return { ok: false, error: "memoTooLong" };
  if (FORBIDDEN_MULTILINE.test(memo)) return { ok: false, error: "memoInvalid" };
  const anchor: Anchor = { paragraph: selection.paragraph, start: selection.start, end: selection.end, quote };
  return memo === "" ? { ok: true, anchor } : { ok: true, anchor, memo };
}

/** The whole paragraph as a selection, for those who cannot select with a pointer; leading and trailing spaces stay out. */
export function wholeParagraph(lines: readonly string[], paragraph: number): Selection | null {
  const line = lines[paragraph];
  if (line === undefined) return null;
  const start = line.length - line.trimStart().length;
  const end = line.trimEnd().length;
  return end > start ? { paragraph, start, end } : null;
}

/** The passages in the codebook's order, then the text's order. A passage of a code that is gone is kept last, never dropped. */
export function orderSegments(segments: readonly Segment[], codes: readonly Code[]): readonly Segment[] {
  const rank = new Map(codes.map((c, i) => [c.id, i]));
  const at = (s: Segment) => rank.get(s.codeId) ?? codes.length;
  return [...segments].sort((a, b) => at(a) - at(b) || a.paragraph - b.paragraph || a.start - b.start || a.end - b.end);
}

export function countText(n: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? forms.one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms.few : forms.many;
  return form.replace("{n}", String(n));
}
