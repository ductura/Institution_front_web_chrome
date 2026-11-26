// WEB-V18-UPITNIK-ISPUNJAVANJE: the pure rules of the form: which answer a field holds, the checks the server
// also makes, and the body of the sheet. An unanswered question is left out of the sheet (the server needs at
// least one answer); nothing here scores, ranks or links an answer to a person.
import type { Form } from "./read";

export const MAX_TEXT = 2000;
type Question = Form["questions"][number];
export type Value = string | number | string[];
/** What the student has typed per question id: a string for every kind but "multiple", which holds codes. */
export type Fields = Readonly<Record<string, string | readonly string[]>>;
export type FieldError = "singleInvalid" | "multipleInvalid" | "scaleInvalid" | "numberInvalid" | "textTooLong" | "textInvalid";
export type Built =
  | { readonly ok: true; readonly answers: { questionId: string; value: Value }[] }
  | { readonly ok: false; readonly error: "none" }
  | { readonly ok: false; readonly error: FieldError; readonly questionId: string };

// Control characters other than newline, carriage return and tab, and the bidi controls.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏؜‪-‮⁦-⁩]/;
const NUMBER = /^-?\d{1,15}([.,]\d{1,10})?$/;

export const emptyField = (q: Question): string | readonly string[] => (q.kind === "multiple" ? [] : "");

/** The integers a scale offers, from its minimum to its maximum. */
export function scaleValues(q: Question): readonly number[] {
  if (q.scale === null) return [];
  const out: number[] = [];
  for (let n = q.scale.min; n <= q.scale.max; n += 1) out.push(n);
  return out;
}

export type One = { readonly ok: true; readonly value: Value } | { readonly ok: true; readonly value: null } | { readonly ok: false; readonly error: FieldError };

/** One field against its question: null is "not answered", an error is a value the server would refuse. */
export function checkField(q: Question, field: string | readonly string[] | undefined): One {
  const empty = field === undefined || field === "" || (typeof field !== "string" && field.length === 0);
  if (empty) return { ok: true, value: null };
  const codes = (q.options ?? []).map((o) => o.code);
  switch (q.kind) {
    case "single":
      return typeof field === "string" && codes.includes(field) ? { ok: true, value: field } : { ok: false, error: "singleInvalid" };
    case "multiple": {
      const picked = typeof field === "string" ? [field] : [...new Set(field)];
      return picked.every((c) => codes.includes(c)) ? { ok: true, value: picked } : { ok: false, error: "multipleInvalid" };
    }
    case "scale": {
      const n = typeof field === "string" && /^\d{1,2}$/.test(field) ? Number(field) : NaN;
      return q.scale !== null && Number.isInteger(n) && n >= q.scale.min && n <= q.scale.max ? { ok: true, value: n } : { ok: false, error: "scaleInvalid" };
    }
    case "number": {
      const raw = typeof field === "string" ? field.trim() : "";
      if (!NUMBER.test(raw)) return { ok: false, error: "numberInvalid" };
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: "numberInvalid" };
    }
    case "text": {
      const text = typeof field === "string" ? field.normalize("NFC").trim() : "";
      if (text === "") return { ok: true, value: null };
      if ([...text].length > MAX_TEXT) return { ok: false, error: "textTooLong" };
      return FORBIDDEN_TEXT.test(text) ? { ok: false, error: "textInvalid" } : { ok: true, value: text };
    }
  }
}

/** The sheet to send, in the order of the questions, or the first problem. */
export function buildSheet(questions: readonly Question[], fields: Fields): Built {
  const answers: { questionId: string; value: Value }[] = [];
  for (const q of [...questions].sort((a, b) => a.order - b.order)) {
    const r = checkField(q, fields[q.id]);
    if (!r.ok) return { ok: false, error: r.error, questionId: q.id };
    if (r.value !== null) answers.push({ questionId: q.id, value: r.value });
  }
  return answers.length === 0 ? { ok: false, error: "none" } : { ok: true, answers };
}
