// WEB-V19-RECENZIJA-NASTAVNIK: the pure rules of the teacher's peer-review screens: the check of the round the
// server also makes (so a bad input costs no round trip), Zagreb wall time to and from the contract's UTC
// instant, and the one order of the allocations: by name, never by anything about the review itself
// (val19-razlika V19-11: no total, no list by quality, no mark).
import type { Allocation, Round, RoundBody } from "./read";

export const MAX_RUBRICS = 6;
export const MAX_LABEL = 120;
export const MAX_REASON = 600;
export const PER_STUDENT: readonly (1 | 2 | 3)[] = [1, 2, 3];

/** Controls but tab and new line, bidi controls and lone surrogates: what the contract refuses in a text. */
// eslint-disable-next-line no-control-regex
const REFUSED = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// A label takes no new line or tab either.
// eslint-disable-next-line no-control-regex
const REFUSED_LABEL = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// ---- Zagreb wall time <-> instant -------------------------------------------------------------------------

const parts = (ms: number): Record<string, number> => {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
};
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** An instant as "YYYY-MM-DDTHH:mm" in Zagreb, the value of a datetime-local field; "" for anything that is no instant. */
export function toLocalInput(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const p = parts(ms);
  return `${pad(p.year!, 4)}-${pad(p.month!)}-${pad(p.day!)}T${pad(p.hour!)}:${pad(p.minute!)}`;
}

/** "YYYY-MM-DDTHH:mm" read as Zagreb wall time, as the contract's instant (milliseconds, Z); null when it is no real time. */
export function fromLocalInput(value: string): string | null {
  const m = LOCAL.exec(value);
  if (m === null) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset (it changes at most once near the guess).
  let ms = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = parts(ms);
    ms += asUtc - Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!);
  }
  return toLocalInput(new Date(ms).toISOString()) === value ? new Date(ms).toISOString() : null;
}

// ---- the round ---------------------------------------------------------------------------------------------

export type RubricDraft = { readonly key: string; readonly label: string };
export type RoundDraft = { readonly opensAt: string; readonly dueAt: string; readonly reviewsPerStudent: string; readonly rubrics: readonly RubricDraft[] };
export type RoundError = "date" | "order" | "perStudent" | "rubricCount" | "rubricLabel" | "rubricDuplicate";
export type Checked =
  | { readonly ok: true; readonly value: RoundBody }
  | { readonly ok: false; readonly field: "opensAt" | "dueAt" | "reviewsPerStudent" | "rubrics"; readonly error: RoundError };

/** The first free key of the contract's shape; the rubric is named by its label, the key is only an identity. */
export function nextKey(rubrics: readonly RubricDraft[]): string {
  const used = new Set(rubrics.map((r) => r.key));
  for (let n = 1; ; n++) if (!used.has(`kriterij-${n}`)) return `kriterij-${n}`;
}

export const EMPTY_DRAFT: RoundDraft = { opensAt: "", dueAt: "", reviewsPerStudent: "1", rubrics: [{ key: "kriterij-1", label: "" }] };

export const draftOf = (round: Round | null): RoundDraft =>
  round === null ? EMPTY_DRAFT : {
    opensAt: toLocalInput(round.opensAt), dueAt: toLocalInput(round.dueAt), reviewsPerStudent: String(round.reviewsPerStudent),
    rubrics: round.rubrics.map((r) => ({ key: r.key, label: r.label })),
  };

export const checkLabel = (raw: string): boolean => {
  const label = raw.replace(/\r\n?/g, "\n");
  const n = Array.from(label).length;
  return n >= 1 && n <= MAX_LABEL && label === label.trim() && !REFUSED_LABEL.test(label);
};

export function checkRound(draft: RoundDraft): Checked {
  const opensAt = fromLocalInput(draft.opensAt);
  if (opensAt === null) return { ok: false, field: "opensAt", error: "date" };
  const dueAt = fromLocalInput(draft.dueAt);
  if (dueAt === null) return { ok: false, field: "dueAt", error: "date" };
  if (Date.parse(dueAt) <= Date.parse(opensAt)) return { ok: false, field: "dueAt", error: "order" };
  const per = Number(draft.reviewsPerStudent);
  if (per !== 1 && per !== 2 && per !== 3) return { ok: false, field: "reviewsPerStudent", error: "perStudent" };
  if (draft.rubrics.length < 1 || draft.rubrics.length > MAX_RUBRICS) return { ok: false, field: "rubrics", error: "rubricCount" };
  // The label is trimmed once here, so " Argument " is what the teacher meant, not an error.
  const rubrics = draft.rubrics.map((r) => ({ key: r.key, label: r.label.trim() }));
  if (rubrics.some((r) => !checkLabel(r.label))) return { ok: false, field: "rubrics", error: "rubricLabel" };
  if (new Set(rubrics.map((r) => r.label.toLowerCase())).size !== rubrics.length) return { ok: false, field: "rubrics", error: "rubricDuplicate" };
  return { ok: true, value: { opensAt, dueAt, reviewsPerStudent: per, rubrics } };
}

/** Does the round take a change: not once the reviews are allocated (the server answers 409 then). */
export const mayEdit = (round: Round | null): boolean => round === null || round.allocatedAt === null;

/** May the teacher allocate now: a round is set, not yet allocated and enough works are submitted (the server's number). */
export const mayAllocate = (view: { readonly round: Round | null; readonly state: string; readonly submittedWorks: number; readonly minSubmissions: number }): boolean =>
  view.round !== null && view.state === "not_allocated" && view.submittedWorks >= view.minSubmissions;

// ---- the overview ------------------------------------------------------------------------------------------

const collator = new Intl.Collator("hr", { sensitivity: "base", numeric: true });
const full = (p: { readonly givenName: string; readonly familyName: string }) => `${p.givenName} ${p.familyName}`.trim();
export const fullName = full;

/** The allocations by reviewer's family and given name, then the author's: the only order there is. */
export function inNameOrder(allocations: readonly Allocation[]): readonly Allocation[] {
  const cmp = (a: { givenName: string; familyName: string }, b: { givenName: string; familyName: string }) =>
    collator.compare(a.familyName, b.familyName) || collator.compare(a.givenName, b.givenName);
  return [...allocations].sort((a, b) => cmp(a.reviewer, b.reviewer) || cmp(a.author, b.author));
}

/** May this allocation's review be withdrawn: it was sent (and so has an id) and is not withdrawn already. */
export const mayWithdraw = (a: Allocation): a is Allocation & { reviewId: string } => a.state === "submitted" && a.reviewId !== null;

export type ReasonError = "empty" | "tooLong" | "badChars";
export function checkReason(raw: string): { readonly reason: string; readonly error: null } | { readonly reason: null; readonly error: ReasonError } {
  const reason = raw.replace(/\r\n?/g, "\n").trim();
  if (reason === "") return { reason: null, error: "empty" };
  if (Array.from(reason).length > MAX_REASON) return { reason: null, error: "tooLong" };
  if (REFUSED.test(reason)) return { reason: null, error: "badChars" };
  return { reason, error: null };
}
