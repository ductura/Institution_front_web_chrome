// WEB-V19-DNEVNIK-STUDENT: the pure rules of the journal page: the input checks the server also
// makes (val19-razlika §4 t. 2), the grouping of entries by date and what the signed marks say.
import type { Entry, Hours, Placement, Signoff } from "./read";

export const MAX_ENTRIES = 400;
export const MAX_TEXT = 4000;
export const HOUR_STEPS: readonly Hours[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12];

export type PlacementState = "active" | "upcoming" | "ended";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Control characters other than newline and tab, and the bidi controls (U+202A–202E, U+2066–2069, U+200E/F, U+061C).
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‎‏؜‪-‮⁦-⁩]/;

/** Today as an ISO date in the local calendar. */
export function todayOf(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function placementState(placement: Pick<Placement, "startsOn" | "endsOn">, today: string): PlacementState {
  if (today < placement.startsOn) return "upcoming";
  if (today > placement.endsOn) return "ended";
  return "active";
}

export const activePlacements = (placements: readonly Placement[], today: string): readonly Placement[] =>
  placements.filter((p) => placementState(p, today) === "active");

/** The newest date a new entry may carry: today, but not after the end of the period. */
export const lastEntryDate = (placement: Pick<Placement, "endsOn">, today: string): string => (today < placement.endsOn ? today : placement.endsOn);

export type Draft = { readonly date: string; readonly hours: string; readonly text: string };
export type FieldError = "dateRequired" | "dateInvalid" | "dateFuture" | "dateOutside" | "hoursInvalid" | "textRequired" | "textTooLong" | "textInvalid" | "full";
export type Checked =
  | { readonly ok: true; readonly value: { readonly date: string; readonly hours: Hours; readonly text: string } }
  | { readonly ok: false; readonly field: "date" | "hours" | "text" | "form"; readonly error: FieldError };

/** "1,5" and "1.5" are the same number; anything else is not a step of the journal. */
export function hoursOf(raw: string): Hours | null {
  const n = Number(raw.trim().replace(",", "."));
  return HOUR_STEPS.find((step) => step === n) ?? null;
}

export function checkDraft(draft: Draft, placement: Pick<Placement, "startsOn" | "endsOn" | "entryCount">, today: string): Checked {
  if (placement.entryCount >= MAX_ENTRIES) return { ok: false, field: "form", error: "full" };
  if (draft.date === "") return { ok: false, field: "date", error: "dateRequired" };
  if (!isIsoDate(draft.date)) return { ok: false, field: "date", error: "dateInvalid" };
  if (draft.date > today) return { ok: false, field: "date", error: "dateFuture" };
  if (draft.date < placement.startsOn || draft.date > placement.endsOn) return { ok: false, field: "date", error: "dateOutside" };
  const hours = hoursOf(draft.hours);
  if (hours === null) return { ok: false, field: "hours", error: "hoursInvalid" };
  const text = draft.text.normalize("NFC");
  if (text.trim() === "") return { ok: false, field: "text", error: "textRequired" };
  if ([...text].length > MAX_TEXT) return { ok: false, field: "text", error: "textTooLong" };
  if (FORBIDDEN_CHARS.test(text)) return { ok: false, field: "text", error: "textInvalid" };
  return { ok: true, value: { date: draft.date, hours, text } };
}

/** Entry dates newest first; inside a day, in the order they were written. Never sorted by anything else. */
export function groupByDate(entries: readonly Entry[]): readonly { readonly date: string; readonly entries: readonly Entry[] }[] {
  const days = new Map<string, Entry[]>();
  for (const entry of entries) days.set(entry.date, [...(days.get(entry.date) ?? []), entry]);
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, entries: [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.entryId.localeCompare(b.entryId)) }));
}

/** The latest date any signature covers, or null. */
export function signedThroughOf(signoffs: readonly Signoff[]): string | null {
  return signoffs.reduce<string | null>((latest, s) => (latest === null || s.throughDate > latest ? s.throughDate : latest), null);
}

/** A signature covers the entries up to its date that existed when it was made; a later one for an older date needs a new signature. */
export function isSigned(entry: Entry, signoffs: readonly Signoff[]): boolean {
  return signoffs.some((s) => entry.date <= s.throughDate && entry.createdAt <= s.signedAt);
}

/** The ids of entries a newer entry corrects: they stay in the list, marked. */
export function correctedIds(entries: readonly Entry[]): ReadonlySet<string> {
  return new Set(entries.flatMap((e) => (e.correctsEntryId === null ? [] : [e.correctsEntryId])));
}

/** Signatures newest first; the order of the server is not trusted. */
export const signoffsNewestFirst = (signoffs: readonly Signoff[]): readonly Signoff[] =>
  [...signoffs].sort((a, b) => b.signedAt.localeCompare(a.signedAt) || b.signoffId.localeCompare(a.signoffId));

export function countText(n: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? forms.one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms.few : forms.many;
  return form.replace("{n}", String(n));
}
