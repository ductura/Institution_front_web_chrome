// Pure rules of the N-01 task facts (WEB-2145; PARITET N-01, prijedlog 5). Per assignment: "Otvorilo rad:
// X od Y studenata", the students who have not opened it, "Zbroj: …" in words (no ranking) and a line per
// student as the prototype's `subLine`. Sources: teacher.course-students.get (state, document), and per
// assignment teacher.submissions.get (version), teacher.assignment-overview.get (time, after-deadline field, record)
// and teacher.deadline-extensions.get. A part that is not read is left out, never guessed. No network here.
import { compareHr } from "../../../../../editor-core/src/document/text/compare-hr";
import type { TeacherCourse } from "../../../../../../src/components/teacher/teacher-courses-read";
import { assignmentFactsMessages as text } from "./messages.hr";

export type WorkState = "not_started" | "in_progress" | "submitted";

/** One student's work on one assignment, from teacher.course-students.get. */
export type StudentWork = {
  readonly studentId: string;
  readonly givenName: string | null;
  readonly familyName: string | null;
  readonly state: WorkState;
  readonly documentId: string | null;
};

/** What the server says of one submission; a null field is one it does not say. */
export type SubmissionDetail = {
  readonly requestedMinute: string | null;
  readonly afterDeadline: boolean | null;
  readonly revision: number | null;
  readonly record: "continuous" | "with_gaps" | null;
};

export type Extension = { readonly scope: "one" | "all"; readonly studentId: string | null; readonly dueAt: string };

/** The reads of one assignment; null where that read failed. */
export type AssignmentReads = {
  readonly dueAt: string;
  readonly works: readonly StudentWork[];
  readonly details: ReadonlyMap<string, SubmissionDetail> | null;
  readonly extensions: readonly Extension[] | null;
};

export type RowKind = "submitted" | "writing" | "notSubmitted" | "notOpened";
export type FactRow = {
  readonly studentId: string;
  readonly name: string;
  readonly kind: RowKind;
  readonly line: string;
  /** Only for an opened work with a safe id: the link "Otvori rad". */
  readonly documentId: string | null;
};

export type AssignmentFacts = {
  readonly rows: readonly FactRow[];
  /** null when no student is on the assignment. */
  readonly opened: string | null;
  readonly sum: string | null;
};

const ZAGREB = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** `8. 11. 2026. u 23:59` in Europe/Zagreb; null for an instant that is not valid. */
export function whenHr(iso: string | null): string | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const p = Object.fromEntries(ZAGREB.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${Number(p.day)}. ${Number(p.month)}. ${p.year}. ${text.at} ${p.hour}:${p.minute}`;
}

export function nameOf(work: Pick<StudentWork, "givenName" | "familyName">): string {
  return work.givenName === null || work.familyName === null ? text.noName : `${work.givenName} ${work.familyName}`;
}

/** By family name, then given name (as the prototype "studenti po prezimenu"); no name last. */
export function byFamilyName(a: StudentWork, b: StudentWork): number {
  if (a.familyName === null || b.familyName === null) return a.familyName === null ? (b.familyName === null ? 0 : 1) : -1;
  return compareHr(a.familyName, b.familyName) || compareHr(a.givenName ?? "", b.givenName ?? "");
}

/** The deadline of one student: the latest extension for that student or for all, else the assignment's. */
export function deadlineOf(studentId: string, dueAt: string, extensions: readonly Extension[] | null): { dueAt: string; extended: boolean } {
  let due: string | null = null;
  for (const e of extensions ?? []) if (e.scope === "all" || e.studentId === studentId) due = e.dueAt;
  return due === null ? { dueAt, extended: false } : { dueAt: due, extended: true };
}

const safeId = (id: string | null): string | null => (id !== null && /^[\w-]+$/.test(id) ? id : null);

function submittedLine(detail: SubmissionDetail | undefined, known: boolean): string {
  if (!known) return `${text.submitted}, ${text.detailsUnavailable}`;
  if (detail === undefined) return text.submitted;
  const when = whenHr(detail.requestedMinute);
  let head = when === null ? text.submitted : text.submittedAt(when);
  if (detail.afterDeadline !== null) head += `, ${detail.afterDeadline ? text.afterDeadline : text.beforeDeadline}`;
  const parts = [head];
  if (detail.revision !== null) parts.push(text.version(detail.revision));
  if (detail.record !== null) parts.push(detail.record === "with_gaps" ? text.recordGaps : text.recordContinuous);
  return parts.join(", ");
}

/** One row per student: state in words; "u pisanju" turns into "nije predano" only once that student's deadline passed. */
export function rowOf(work: StudentWork, reads: AssignmentReads, now: number): FactRow {
  const base = { studentId: work.studentId, name: nameOf(work), documentId: work.state === "not_started" ? null : safeId(work.documentId) };
  if (work.state === "not_started") return { ...base, kind: "notOpened", line: text.notOpenedLine };
  if (work.state === "submitted") {
    return { ...base, kind: "submitted", line: submittedLine(reads.details?.get(work.studentId), reads.details !== null) };
  }
  const deadline = deadlineOf(work.studentId, reads.dueAt, reads.extensions);
  const dueMs = Date.parse(deadline.dueAt);
  const due = whenHr(deadline.dueAt) ?? deadline.dueAt;
  if (Number.isFinite(dueMs) && now >= dueMs) return { ...base, kind: "notSubmitted", line: text.notSubmitted(due) };
  return { ...base, kind: "writing", line: deadline.extended ? `${text.writing}, ${text.extendedTo(due)}` : text.writing };
}

/** The facts of one assignment; the order of rows is by name only, never by any figure. */
export function factsOf(reads: AssignmentReads, now: number): AssignmentFacts {
  const works = [...reads.works].sort(byFamilyName);
  const rows = works.map((w) => rowOf(w, reads, now));
  if (rows.length === 0) return { rows, opened: null, sum: null };
  const count = (kind: RowKind) => rows.filter((r) => r.kind === kind).length;
  const closed = rows.filter((r) => r.kind === "notOpened").map((r) => r.name);
  const submitted = count("submitted");
  const late = reads.details === null ? null
    : works.filter((w) => w.state === "submitted" && reads.details?.get(w.studentId)?.afterDeadline === true).length;
  const parts: string[] = [];
  if (submitted) parts.push(text.sumSubmitted(submitted, late));
  if (count("writing")) parts.push(text.sumWriting(count("writing")));
  if (count("notSubmitted")) parts.push(text.sumNotSubmitted(count("notSubmitted")));
  if (closed.length) parts.push(text.sumNotOpened(closed.length));
  return {
    rows,
    opened: text.opened(rows.length - closed.length, rows.length) + (closed.length ? text.notOpened(closed) : ""),
    sum: text.sum(parts),
  };
}

export type Interrupted = { readonly courseId: string | null; readonly title: string | null };

/** `?objava=prekinuta&kolegij=…&zadatak=…`, as the assignment form links here after a lost reply. */
export function interruptedOf(query: Pick<URLSearchParams, "get">): Interrupted | null {
  if (query.get("objava") !== "prekinuta") return null;
  const title = query.get("zadatak");
  return { courseId: query.get("kolegij"), title: title === null || title.trim() === "" ? null : title.trim() };
}

/** Whether the list now holds the assignment; null when the link did not name it. */
export function publishedIn(courses: readonly TeacherCourse[], which: Interrupted): boolean | null {
  if (which.title === null) return null;
  return courses.some((c) => (which.courseId === null || c.id === which.courseId) && c.assignments.some((a) => a.title.trim() === which.title));
}
