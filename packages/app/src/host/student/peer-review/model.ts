// WEB-V19-RECENZIJA-STUDENT: the pure rules of the peer-review screens. Nothing here counts, sorts by an
// amount, ranks, marks or names a person (val19-razlika V19-11): works are "Rad 1, 2, …" by position,
// received reviews are in the order they were sent.
import type { ReceivedView, TasksView, WorkView } from "./read";

export const MAX_TEXT = 4000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID.test(s);

/** The characters the contract refuses in a review text (controls but tab and new line, bidi controls, lone surrogates). */
// eslint-disable-next-line no-control-regex
const REFUSED = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export type TextError = "tooLong" | "badChars";
export type Checked = { readonly text: string | null; readonly error: TextError | null };

/** A browser textarea returns CRLF; the contract takes a bare new line. Blank is "left empty" (null). */
export function checkText(raw: string): Checked {
  const text = raw.replace(/\r\n?/g, "\n");
  if (text.trim() === "") return { text: null, error: null };
  if (Array.from(text).length > MAX_TEXT) return { text: null, error: "tooLong" };
  if (REFUSED.test(text)) return { text: null, error: "badChars" };
  return { text, error: null };
}

export type Draft = { readonly byRubric: Readonly<Record<string, string>>; readonly general: string };
export const EMPTY_DRAFT: Draft = { byRubric: {}, general: "" };

export type Built =
  | { readonly ok: true; readonly body: { readonly byRubric: { key: string; text: string }[]; readonly general?: string } }
  | { readonly ok: false; readonly error: "empty" | "invalid"; readonly fields: Readonly<Record<string, TextError>> };

/**
 * The body of the review in the rubrics' own order. A blank rubric is left out and a review needs at least one;
 * the general comment is optional. A text the contract would refuse is named per field, never sent.
 */
export function buildReview(rubrics: WorkView["rubrics"], draft: Draft): Built {
  const fields: Record<string, TextError> = {};
  const byRubric: { key: string; text: string }[] = [];
  for (const rubric of rubrics) {
    const checked = checkText(draft.byRubric[rubric.key] ?? "");
    if (checked.error !== null) fields[rubric.key] = checked.error;
    else if (checked.text !== null) byRubric.push({ key: rubric.key, text: checked.text });
  }
  const general = checkText(draft.general);
  if (general.error !== null) fields.general = general.error;
  if (Object.keys(fields).length > 0) return { ok: false, error: "invalid", fields };
  if (byRubric.length === 0) return { ok: false, error: "empty", fields };
  return { ok: true, body: general.text === null ? { byRubric } : { byRubric, general: general.text } };
}

/** The works by position: the label never carries anything that leads to a person. */
export const workNumber = (index: number): number => index + 1;

export const dueLabel = (iso: string): string =>
  new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zagreb" }).format(new Date(iso));

/** The reviews in the order they were sent (time, not quality). */
export const inSentOrder = (reviews: ReceivedView["reviews"]): ReceivedView["reviews"] =>
  [...reviews].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

export type Block = WorkView["document"]["blocks"][number];
export type Rendered = { readonly kind: "list"; readonly items: readonly string[] } | { readonly kind: "block"; readonly block: Block };

/** Consecutive list items become one list; the rest stay as they are. */
export function grouped(blocks: readonly Block[]): readonly Rendered[] {
  const out: Rendered[] = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    if (block.kind !== "list_item") out.push({ kind: "block", block });
    else if (last?.kind === "list") out[out.length - 1] = { kind: "list", items: [...last.items, block.text] };
    else out.push({ kind: "list", items: [block.text] });
  }
  return out;
}

/** May the student write a review for this task now: the round is open and the task is still waiting. */
export const mayWrite = (view: TasksView, task: TasksView["tasks"][number]): boolean => view.state === "open" && task.state === "pending";
