// WEB-V18-KODIRANJE-GRADIVO: the pure rules of the materials page: the input checks the server also makes
// (val18-razlika V18-7), the lines of a text and the plural forms.
import type { Kind } from "./read";

export const MAX_TITLE = 200;
/** val18-razlika V18-7 / SRV-V18-KODIRANJE-BAZA: text up to 100 000 characters (the wire allows more; the page keeps the stricter bound). */
export const MAX_TEXT = 100_000;
export const MAX_MATERIALS = 200;
export const KINDS: readonly Kind[] = ["interview", "note"];

// Control characters other than newline, carriage return and tab, and the bidi controls (U+202A–202E, U+2066–2069, U+200E/F, U+061C).
// eslint-disable-next-line no-control-regex
const FORBIDDEN_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏؜‪-‮⁦-⁩]/;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_TITLE = /[\u0000-\u001F\u007F-\u009F‎‏؜‪-‮⁦-⁩]/;

export type Draft = { readonly title: string; readonly kind: string; readonly text: string };
export type FieldError = "titleRequired" | "titleTooLong" | "titleInvalid" | "kindInvalid" | "textRequired" | "textTooLong" | "textInvalid" | "full";
export type Checked =
  | { readonly ok: true; readonly value: { readonly title: string; readonly kind: Kind; readonly text: string } }
  | { readonly ok: false; readonly field: "title" | "kind" | "text" | "form"; readonly error: FieldError };

export const isKind = (value: string): value is Kind => (KINDS as readonly string[]).includes(value);

/** `count` is how many materials the student already has. */
export function checkDraft(draft: Draft, count: number): Checked {
  if (count >= MAX_MATERIALS) return { ok: false, field: "form", error: "full" };
  const title = draft.title.normalize("NFC").trim();
  if (title === "") return { ok: false, field: "title", error: "titleRequired" };
  if ([...title].length > MAX_TITLE) return { ok: false, field: "title", error: "titleTooLong" };
  if (FORBIDDEN_TITLE.test(title)) return { ok: false, field: "title", error: "titleInvalid" };
  if (!isKind(draft.kind)) return { ok: false, field: "kind", error: "kindInvalid" };
  const text = draft.text.normalize("NFC");
  if (text.trim() === "") return { ok: false, field: "text", error: "textRequired" };
  if ([...text].length > MAX_TEXT) return { ok: false, field: "text", error: "textTooLong" };
  if (FORBIDDEN_TEXT.test(text)) return { ok: false, field: "text", error: "textInvalid" };
  return { ok: true, value: { title, kind: draft.kind, text } };
}

/** The lines of a text, in order; an empty line stays (its place counts), the line break itself is dropped. */
export const linesOf = (text: string): readonly string[] => text.split(/\r\n|\r|\n/);

export function countText(n: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? forms.one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms.few : forms.many;
  return form.replace("{n}", String(n));
}
