// WEB-2103 (paritet E-3/E-4): what the two pages show of the reads. Pure
// functions over what student.assignments.get and student.assignment-work.get
// returned; nothing is guessed (no submit time, no state the reads do not prove).
import { protoToday } from "../home/format";
import { coursesText as t } from "./messages.hr";

export type WorkType = keyof typeof t.workTypes;
export type Group = { id: string; name: string };
export type Mentor = { id: string; givenName: string; familyName: string };

export type RowKind = "submitted" | "notice" | "work" | "task";

/** Seminar group chips, "Seminarska grupa 2"; a name that already says so is kept. */
export function groupLabels(groups: readonly Group[] | undefined): string[] {
  return (groups ?? []).map((g) => (/^seminarska/iu.test(g.name) ? g.name : `${t.group} ${g.name}`));
}

export function workTypeLabel(type: string | undefined): string | null {
  return type !== undefined && type in t.workTypes ? t.workTypes[type as WorkType] : null;
}

export function mentorLabel(mentor: Mentor | null | undefined): string | null {
  return mentor ? `${t.mentor}: ${mentor.givenName} ${mentor.familyName}` : null;
}

/** The row kind of INVENTAR "Redak zadatka": submitted, then notice, then started work, else a task. */
export function rowKind(noticeFirst: boolean, state: "not_started" | "in_progress" | "submitted" | null): RowKind {
  if (state === "submitted") return "submitted";
  if (noticeFirst) return "notice";
  return state === "in_progress" ? "work" : "task";
}

export const ROW_ACTION: Record<RowKind, { label: string; primary: boolean }> = {
  submitted: { label: "Otvori rad", primary: false },
  notice: { label: "Pročitaj upute", primary: false },
  work: { label: "Otvori rad", primary: true },
  task: { label: "Otvori zadatak", primary: true },
};

/** "Rok za 3 dana" for a deadline in 1..7 whole days, "Rok je danas" within a day; none otherwise (incl. past). */
export function nearTag(dueIso: string, now: Date): string | null {
  const ms = Date.parse(dueIso) - now.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  if (days > 7) return null;
  if (days <= 1) return t.dueToday;
  return t.dueSoon.replace("{n}", String(days)).replace("{unit}", days % 10 === 1 && days !== 11 ? t.dayOne : t.dayMany);
}

/**
 * P-D1: whether the server marked the assignment as practice ("Probni"). Only an explicit `isPractice: true`
 * in the server's answer counts; a missing or other value is a regular assignment, never a local guess.
 */
export function practiceOf(assignment: object): boolean {
  return "isPractice" in assignment && assignment.isPractice === true;
}

/** The deadline in force: an extension replaces the original. */
export function effectiveDue(dueAt: string, extendedDueAt: string | null | undefined): string {
  return typeof extendedDueAt === "string" && extendedDueAt !== "" ? extendedDueAt : dueAt;
}

// ---- NF-1 P-3: the one deadline function of E-2, E-3 and E-4 ------------------------------------

/**
 * P-3: the deadline tag of a row that is not submitted. "Rok je prošao {datum}" once the deadline in force
 * (the extended one when given) has passed. While an extension the teacher gave this student still runs, the
 * row says the original deadline has passed, so both states are told apart. Null for a submitted row, before
 * the original deadline, and for a deadline that does not parse. The tag describes the deadline, not the student.
 */
export type DeadlineTag = { readonly kind: "late" | "extension"; readonly text: string };

export function deadlineTagOf(
  input: { readonly submitted: boolean; readonly dueAt: string; readonly extended: boolean; readonly originalDueAt: string },
  now: number,
): DeadlineTag | null {
  if (input.submitted) return null;
  const due = Date.parse(input.dueAt);
  if (Number.isNaN(due)) return null;
  if (due < now) return { kind: "late", text: t.deadlinePassed.replace("{date}", protoToday(new Date(due))) };
  const original = Date.parse(input.originalDueAt);
  if (input.extended && !Number.isNaN(original) && original < now) {
    return { kind: "extension", text: t.originalDeadlinePassed.replace("{date}", protoToday(new Date(original))) };
  }
  return null;
}

// ---- NF-1 P-5: the state filter of "Moji radovi" -------------------------------------------------

export const STATE_FILTERS = ["sve", "zapredati", "predano", "obavijest"] as const;
export type StateFilter = (typeof STATE_FILTERS)[number];

/** `?stanje=`: a value outside the closed set is "sve", never a guess. */
export function stateFilterOf(raw: string | null | undefined): StateFilter {
  return (STATE_FILTERS as readonly string[]).includes(raw ?? "") ? (raw as StateFilter) : "sve";
}

/** Narrows the row kinds only: "Za predati" is work and tasks not yet submitted, "Čeka potvrdu uputa" the notice rows. */
export function matchesState(kind: RowKind, filter: StateFilter): boolean {
  if (filter === "sve") return true;
  if (filter === "predano") return kind === "submitted";
  if (filter === "obavijest") return kind === "notice";
  return kind === "work" || kind === "task";
}

// ---- NF-1 P-6: the submission time, only when the server's answer carries it ---------------------

export type Submitted = { submittedAt: string; afterDeadline: boolean };

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/**
 * The time of a submission from one item of student.assignment-submissions.get (SRV#701), or null. A null
 * `submittedAt` (not submitted) or an invalid one gives null; `afterDeadline` counts only when it is the boolean true. Nothing is computed from the deadline here.
 */
export function submittedOf(item: object): Submitted | null {
  const at = "submittedAt" in item ? item.submittedAt : undefined;
  if (typeof at !== "string" || !INSTANT.test(at) || Number.isNaN(Date.parse(at))) return null;
  return { submittedAt: at, afterDeadline: "afterDeadline" in item && item.afterDeadline === true };
}

export function submittedLine(s: Submitted | null | undefined, format: (iso: string) => string): string {
  if (s === null || s === undefined) return t.submittedNoTime;
  return (s.afterDeadline ? t.submittedLate : t.submittedAt).replace("{time}", format(s.submittedAt));
}

// ---- NF-1 P-7: the history of a deadline extension ----------------------------------------------

export type ExtensionNote = { previousDueAt: string; scope: "one" | "all"; reasonId: keyof typeof t.extensionReason | null };

/**
 * The extension behind the deadline in force: from the student's own history, the latest record whose
 * `dueAt` is the extended deadline. No such record (or a body of another shape) is null, and the row then
 * shows only "Produljeni rok" without a history, never an invented one.
 */
export function extensionOf(body: unknown, extendedDueAt: string): ExtensionNote | null {
  const list = typeof body === "object" && body !== null && "extensions" in body ? body.extensions : null;
  if (!Array.isArray(list)) return null;
  const until = Date.parse(extendedDueAt);
  let best: { note: ExtensionNote; created: number } | null = null;
  for (const e of list as unknown[]) {
    if (typeof e !== "object" || e === null) continue;
    const r = e as Record<string, unknown>;
    if (typeof r.dueAt !== "string" || Date.parse(r.dueAt) !== until || typeof r.previousDueAt !== "string" || Number.isNaN(Date.parse(r.previousDueAt))) continue;
    if (r.scope !== "one" && r.scope !== "all") continue;
    const reasonId = typeof r.reasonId === "string" && r.reasonId in t.extensionReason ? (r.reasonId as keyof typeof t.extensionReason) : null;
    const created = typeof r.createdAt === "string" ? Date.parse(r.createdAt) : 0;
    if (best === null || created >= best.created) best = { note: { previousDueAt: r.previousDueAt, scope: r.scope, reasonId }, created };
  }
  return best?.note ?? null;
}

export function extensionText(note: ExtensionNote, format: (iso: string) => string): string {
  const scope = t.extensionScope[note.scope];
  const prev = format(note.previousDueAt);
  return note.reasonId === null
    ? t.extensionNoReason.replace("{prev}", prev).replace("{scope}", scope)
    : t.extension.replace("{prev}", prev).replace("{reason}", t.extensionReason[note.reasonId]).replace("{scope}", scope);
}
