// WEB-V19-DNEVNIK-MENTOR: the pure rules of the mentor's journal screens: the checks of the "open a
// practice" form and of the "sign through a date" form (val19-razlika §4 t. 1 and 3), the join of a practice
// with its mentorship's student name, and what is still waiting for a signature. The server checks it all
// again; these only spare a round trip.
import { isIsoDate } from "../../student/practice-journal/model";
import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { byFamilyName, studentName } from "../../../../../../src/components/teacher/mentored-works-view";
import type { Entry, Placement, Signoff } from "../../student/practice-journal/read";

export const MAX_ORGANISATION = 120;
export const MAX_COMMENT = 1000;
// Control characters (a tab, a new line and a carriage return are allowed in a comment), and the bidi controls.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_NAME = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_COMMENT = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/;

export type OpenDraft = { readonly mentorshipId: string; readonly organisationName: string; readonly startsOn: string; readonly endsOn: string };
export type OpenError =
  | "mentorshipRequired" | "organisationRequired" | "organisationTooLong" | "organisationInvalid"
  | "startRequired" | "startInvalid" | "endRequired" | "endInvalid" | "endBeforeStart";
export type OpenChecked =
  | { readonly ok: true; readonly value: OpenDraft }
  | { readonly ok: false; readonly field: "mentorshipId" | "organisationName" | "startsOn" | "endsOn"; readonly error: OpenError };

export function checkOpen(draft: OpenDraft, mentorshipIds: readonly string[]): OpenChecked {
  if (draft.mentorshipId === "" || !mentorshipIds.includes(draft.mentorshipId)) return { ok: false, field: "mentorshipId", error: "mentorshipRequired" };
  const name = draft.organisationName.normalize("NFC");
  if (name.trim() === "") return { ok: false, field: "organisationName", error: "organisationRequired" };
  if ([...name].length > MAX_ORGANISATION) return { ok: false, field: "organisationName", error: "organisationTooLong" };
  if (name !== name.trim() || FORBIDDEN_NAME.test(name)) return { ok: false, field: "organisationName", error: "organisationInvalid" };
  if (draft.startsOn === "") return { ok: false, field: "startsOn", error: "startRequired" };
  if (!isIsoDate(draft.startsOn)) return { ok: false, field: "startsOn", error: "startInvalid" };
  if (draft.endsOn === "") return { ok: false, field: "endsOn", error: "endRequired" };
  if (!isIsoDate(draft.endsOn)) return { ok: false, field: "endsOn", error: "endInvalid" };
  if (draft.endsOn < draft.startsOn) return { ok: false, field: "endsOn", error: "endBeforeStart" };
  return { ok: true, value: { mentorshipId: draft.mentorshipId, organisationName: name, startsOn: draft.startsOn, endsOn: draft.endsOn } };
}

export type SignDraft = { readonly throughDate: string; readonly comment: string };
export type SignError = "throughRequired" | "throughInvalid" | "commentTooLong" | "commentInvalid" | "commentBlank" | "nothingNew";
export type SignChecked =
  | { readonly ok: true; readonly value: { readonly throughDate: string; readonly comment?: string } }
  | { readonly ok: false; readonly field: "throughDate" | "comment" | "form"; readonly error: SignError };

/** A blank comment is left out (the contract has none, not an empty one); a comment of only spaces is refused. */
export function checkSign(draft: SignDraft, entries: readonly Entry[], signoffs: readonly Signoff[]): SignChecked {
  if (waitingFor(entries, signoffs).length === 0) return { ok: false, field: "form", error: "nothingNew" };
  if (draft.throughDate === "") return { ok: false, field: "throughDate", error: "throughRequired" };
  if (!isIsoDate(draft.throughDate)) return { ok: false, field: "throughDate", error: "throughInvalid" };
  const comment = draft.comment.normalize("NFC");
  if (comment === "") return { ok: true, value: { throughDate: draft.throughDate } };
  if (comment.trim() === "") return { ok: false, field: "comment", error: "commentBlank" };
  if ([...comment].length > MAX_COMMENT) return { ok: false, field: "comment", error: "commentTooLong" };
  if (FORBIDDEN_COMMENT.test(comment)) return { ok: false, field: "comment", error: "commentInvalid" };
  return { ok: true, value: { throughDate: draft.throughDate, comment } };
}

/** An entry is covered when some signature reaches its date and was made after the entry existed. */
const covered = (entry: Entry, signoffs: readonly Signoff[]) => signoffs.some((s) => entry.date <= s.throughDate && entry.createdAt <= s.signedAt);

/** The entries no signature covers yet, oldest date first (the order a mentor reads them in). */
export function waitingFor(entries: readonly Entry[], signoffs: readonly Signoff[]): readonly Entry[] {
  return entries.filter((e) => !covered(e, signoffs)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.entryId.localeCompare(b.entryId));
}

/** The date offered in the form: the newest date of an entry that still waits, else "". */
export function suggestedThrough(entries: readonly Entry[], signoffs: readonly Signoff[]): string {
  const waiting = waitingFor(entries, signoffs);
  return waiting.length === 0 ? "" : waiting[waiting.length - 1]!.date;
}

export type PlacementRow = { readonly placement: Placement; readonly student: string | null };
export type StudentIndex = ReadonlyMap<string, { readonly name: string; readonly rank: number }>;

/**
 * The mentorships of the works list, each once, in the list's own order (family name, given name, hr
 * collation): the name to show and the place in that order. A work without a name pair keeps the list's
 * stand-in words (#757 D1), never an invented name.
 */
export function studentIndex(works: readonly MentoredWork[]): StudentIndex {
  const index = new Map<string, { name: string; rank: number }>();
  for (const work of byFamilyName(works)) {
    if (!index.has(work.mentorshipId)) index.set(work.mentorshipId, { name: studentName(work), rank: index.size });
  }
  return index;
}

/**
 * The practices joined to the student of their mentorship (the practice has no name of its own). A practice of
 * a mentorship the works list does not know keeps `student: null`: it is shown, last, never hidden and never
 * given a made-up name. Ordered by the student's place in the works list, then by start, then id; never by
 * hours, entries or signatures.
 */
export function placementRows(placements: readonly Placement[], students: StudentIndex): readonly PlacementRow[] {
  const rank = (p: Placement) => students.get(p.mentorshipId)?.rank ?? Number.MAX_SAFE_INTEGER;
  return placements
    .map((placement) => ({ placement, student: students.get(placement.mentorshipId)?.name ?? null }))
    .sort((a, b) => rank(a.placement) - rank(b.placement)
      || a.placement.startsOn.localeCompare(b.placement.startsOn) || a.placement.placementId.localeCompare(b.placement.placementId));
}
