// Pure rules of N-17 "Zbirni pregled" (WEB-2149; INVENTAR-nastavnik 3.6, PARITET N-17). One card per assignment,
// a meta line of counts and a six-column table. The server's overview says submitted or not; the states
// "u pisanju", "obavijest nije potvrđena", the extended deadline and the revision are optional fields:
// when the read does not give them they are shown as such ("nedostupno"), never guessed. No network call here.
import type { CardRole } from "../assignment-card/model";
import { compareHr } from "../../../../../editor-core/src/document/text/compare-hr";
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { deadlineOf, whenHr, type Extension } from "../assignment-facts/model";
import { n17Messages as text } from "./messages.hr";

export type Revision = { readonly state: "open" | "reopened" | "accepted" | "closed" };
export type N17Row = {
  readonly studentId: string;
  readonly name: string | null;
  readonly group: string | null;
  readonly submitted: boolean;
  /** UTC minute `YYYY-MM-DDTHH:MMZ`; only when submitted. */
  readonly requestedMinute: string | null;
  readonly afterDeadline: boolean;
  readonly evidenceRecord: "continuous" | "with_gaps" | null;
  readonly documentId?: string;
  /** Optional until the server says them; `notStarted` comes from teacher.course-students.get (NZ-10). */
  readonly phase?: "writing" | "unconfirmed" | "notStarted";
  readonly deadlineExtended?: boolean;
  /** NZ-10: the version of the submission (teacher.submissions.get `revision`); absent when not read. */
  readonly version?: number | null;
  /** NZ-10: this student's deadline (the assignment's, or the latest extension); absent when not read. */
  readonly dueAt?: string;
  /** Absent: the read does not say. `null`: no revision was requested. */
  readonly revision?: Revision | null;
};

export type N17Card = {
  readonly assignmentId: string;
  readonly title: string;
  readonly courseName: string;
  /** NZ-1/NZ-2: the course and the assignment's own deadline, for the card's meta line and entries. */
  readonly courseId?: string;
  readonly dueAt?: string;
  /** The caller's role in the course; only the holder gets the entries that write (as TaskActions, INVENTAR §7 t. 5). */
  readonly role?: CardRole;
  /** null: the read of this assignment failed. */
  readonly rows: readonly N17Row[] | null;
};

export type N17Read =
  | { readonly kind: "ready"; readonly cards: readonly N17Card[]; readonly course?: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface N17Port {
  read(): Promise<N17Read>;
}

export const unavailablePort: N17Port = { read: async () => ({ kind: "unavailable" }) };

/** Loads through the port; a failure is "unavailable", never an empty list. */
export async function loadN17(port: N17Port): Promise<N17Read> {
  try {
    return await port.read();
  } catch {
    return { kind: "unavailable" };
  }
}

export function stateText(row: N17Row): string {
  if (row.submitted) return text.state.submitted;
  if (row.phase === "writing") return row.deadlineExtended ? text.state.writingExtended : text.state.writing;
  if (row.phase === "unconfirmed") return text.state.unconfirmed;
  if (row.phase === "notStarted") return text.state.notStarted;
  return text.state.notSubmitted;
}

/** NZ-10: "5. 11. 2026. u 21:14 · verzija 2", in the short form of the prototype; "nema" when not submitted. */
export function timeText(row: N17Row): string {
  if (!row.submitted || row.requestedMinute === null) return text.none;
  const when = whenHr(row.requestedMinute) ?? formatDateTimeHr(row.requestedMinute);
  return typeof row.version === "number" && Number.isInteger(row.version) && row.version > 0 ? `${when} · ${text.version(row.version)}` : when;
}

/** NZ-10: "Rok produljen do …" or "Rok …"; "nedostupno" when the deadline was not read. */
export function deadlineText(row: N17Row): string {
  const due = row.dueAt === undefined ? null : whenHr(row.dueAt);
  if (due === null) return text.revisionUnavailable;
  return row.deadlineExtended ? text.extendedTo(due) : text.dueAt(due);
}

/** The card's meta "Rok 8. 11. 2026. u 23:59" (· "rok je prošao"); null without a readable deadline. */
export function cardDeadline(card: Pick<N17Card, "dueAt">, now: number): string | null {
  const due = card.dueAt === undefined ? null : whenHr(card.dueAt);
  if (due === null || card.dueAt === undefined) return null;
  return Date.parse(card.dueAt) < now ? `${text.dueAt(due)} · ${text.deadlinePassed}` : text.dueAt(due);
}

/** What NZ-10 joins to the overview rows; a part that was not read is null and leaves its field absent. */
export type RowJoin = {
  readonly dueAt: string;
  /** teacher.course-students.get for this assignment, by student. */
  readonly works: ReadonlyMap<string, { readonly state: "not_started" | "in_progress" | "submitted"; readonly documentId: string | null }> | null;
  /** teacher.submissions.get, by student. */
  readonly submissions: ReadonlyMap<string, { readonly revision: number | null; readonly documentId: string | null }> | null;
  readonly extensions: readonly Extension[] | null;
};

/**
 * NZ-10: the overview rows with the facts the other reads give: the state (not started, writing; writing
 * whose deadline passed is "nije predano"), the document to open, the version and this student's deadline.
 * Nothing is guessed: a part that was not read leaves its field as it was.
 */
export function joinRows(rows: readonly N17Row[], join: RowJoin, now: number): readonly N17Row[] {
  return rows.map((row) => {
    const work = join.works?.get(row.studentId);
    const sub = join.submissions?.get(row.studentId);
    const documentId = work?.documentId ?? sub?.documentId ?? row.documentId ?? null;
    const deadline = join.extensions === null ? null : deadlineOf(row.studentId, join.dueAt, join.extensions);
    const passed = deadline !== null && Date.parse(deadline.dueAt) <= now;
    const phase: N17Row["phase"] = row.submitted || work === undefined ? row.phase
      : work.state === "not_started" ? "notStarted" : work.state === "in_progress" && !passed ? "writing" : row.phase;
    return {
      ...row,
      ...(documentId === null ? {} : { documentId }),
      ...(phase === undefined ? {} : { phase }),
      ...(sub === undefined ? {} : { version: sub.revision }),
      ...(deadline === null ? {} : { dueAt: deadline.dueAt, deadlineExtended: deadline.extended }),
    };
  });
}

export function afterDeadlineText(row: N17Row): string {
  return !row.submitted ? text.none : row.afterDeadline ? text.yes : text.no;
}

export function recordText(row: N17Row): string {
  if (!row.submitted) return text.none;
  if (row.evidenceRecord === "with_gaps") return text.recordGaps;
  return row.evidenceRecord === "continuous" ? text.recordContinuous : text.recordPending;
}

/** Text only, as D-128 O-3 asks; "nedostupno" when the read gives no revision field at all. */
export function revisionText(row: N17Row): string {
  if (row.revision === undefined) return text.revisionUnavailable;
  return row.revision === null ? text.revisionNone : text.revisionRequested(text.revisionStates[row.revision.state] ?? row.revision.state);
}

/** "predano 1 (od toga 1 nakon roka), u pisanju 2, …": zero counts are left out. */
export function summaryLine(rows: readonly N17Row[]): string {
  const submitted = rows.filter((r) => r.submitted);
  const count = (f: (r: N17Row) => boolean) => rows.filter((r) => !r.submitted && f(r)).length;
  const writing = count((r) => r.phase === "writing");
  const unconfirmed = count((r) => r.phase === "unconfirmed");
  const notStarted = count((r) => r.phase === "notStarted");
  const not = count((r) => r.phase === undefined);
  const parts: string[] = [];
  if (submitted.length > 0) parts.push(text.summary.submitted(submitted.length, submitted.filter((r) => r.afterDeadline).length));
  if (writing > 0) parts.push(text.summary.writing(writing));
  if (not > 0) parts.push(text.summary.notSubmitted(not));
  if (notStarted > 0) parts.push(text.summary.notStarted(notStarted));
  if (unconfirmed > 0) parts.push(text.summary.unconfirmed(unconfirmed));
  return parts.length === 0 ? text.summary.noRows : parts.join(", ");
}

const surname = (name: string): string => name.trim().split(/\s+/).slice(-1)[0] ?? name;

/** By surname, then name; no name last. Never by any figure. */
export function sortedRows(rows: readonly N17Row[]): readonly N17Row[] {
  return rows.slice().sort((a, b) => {
    if (a.name === null || b.name === null) return a.name === b.name ? 0 : a.name === null ? 1 : -1;
    return compareHr(surname(a.name), surname(b.name)) || compareHr(a.name, b.name);
  });
}

/** The live work of a row, only with a safe document id. */
export function workHref(row: N17Row): string | null {
  const id = row.documentId;
  return typeof id === "string" && /^[\w-]+$/.test(id) ? `/nastavnik/rad/${encodeURIComponent(id)}` : null;
}
