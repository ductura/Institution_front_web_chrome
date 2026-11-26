// Pure rules of N-04 "Popis studenata" (WEB-2143; INVENTAR-nastavnik 3.3, PARITET N-04). One row per
// student with a line per assignment: state in words, time, version and the state of the record.
// "Čeka doradu" is text only (D-128 O-3), never a colour. The real port (./port.ts, PIL-K-N04) reads
// teacher.course-students.get; a field the route does not give is left out, never invented.
// This module makes no network call.
import { compareHr } from "../../../../../editor-core/src/document/text/compare-hr";
import { courseStudentsMessages as text } from "./messages.hr";

/** `unknown`: a state this screen does not know, said neutrally (never guessed). */
export type WorkStatus = "submitted" | "writing" | "not_submitted" | "unconfirmed" | "unknown";
export type EvidenceRecord = "continuous" | "with_gaps";
/** Request for a revision: only `open` and `reopened` wait for the student. */
export type RevisionState = "open" | "reopened" | "accepted" | "closed" | "responded" | "withdrawn";

export type RosterWork = {
  readonly assignmentId: string;
  readonly title: string | null;
  readonly workType: string | null;
  readonly status: WorkStatus;
  /** UTC instant, ISO 8601; only for a submitted work. */
  readonly submittedAt?: string | null;
  readonly afterDeadline?: boolean;
  readonly version?: number | null;
  readonly record?: EvidenceRecord | null;
  readonly documentId?: string | null;
  /** NZ-10: this student's extended deadline ("Rok produljen do …"); absent or null when none or not read. */
  readonly extendedTo?: string | null;
  /** Absent: the read does not say. That is not "no revision". */
  readonly revision?: { readonly state: RevisionState; readonly deadline: string | null } | null;
};

export type RosterStudent = {
  readonly studentId: string;
  readonly name: string | null;
  readonly group: string | null;
  readonly works: readonly RosterWork[];
};

export type RosterData = { readonly courseName?: string; readonly students: readonly RosterStudent[] };

export type RosterRead =
  | { readonly kind: "ready"; readonly data: RosterData }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface CourseStudentsPort {
  read(courseId: string): Promise<RosterRead>;
}

/** Without a port the honest answer is "unavailable"; the route mounts the real one (./port.ts). */
export const unavailablePort: CourseStudentsPort = { read: async () => ({ kind: "unavailable" }) };

const ZAGREB = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** `5. 11. 2026. u 21:14`, always in Europe/Zagreb; null for an instant that is not valid. */
export function whenHr(iso: string | null | undefined): string | null {
  if (typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const p = Object.fromEntries(ZAGREB.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${Number(p.day)}. ${Number(p.month)}. ${p.year}. ${text.at} ${p.hour}:${p.minute}`;
}

/** The state of one work in words, as the prototype's `subLine`. */
export function stateLine(work: RosterWork): string {
  switch (work.status) {
    case "submitted": {
      const parts: string[] = [];
      const when = whenHr(work.submittedAt);
      const timing = work.afterDeadline === undefined ? null : work.afterDeadline ? text.afterDeadline : text.beforeDeadline;
      parts.push(when === null ? "Predano" : text.submittedAt(when) + (timing === null ? "" : `, ${timing}`));
      if (when === null && timing !== null) parts[0] = `Predano, ${timing}`;
      if (typeof work.version === "number" && Number.isInteger(work.version) && work.version > 0) parts.push(text.version(work.version));
      if (work.record === "with_gaps") parts.push(text.recordGaps);
      else if (work.record === "continuous") parts.push(text.recordContinuous);
      return parts.join(" · ");
    }
    case "writing": return text.writing;
    case "not_submitted": return text.notSubmitted;
    case "unconfirmed": return text.unconfirmed;
    default: return text.unknownState;
  }
}

/** The route's `workState` in this screen's words; anything else is `unknown`, never a guess. */
export function workStatusOf(state: unknown): WorkStatus {
  switch (state) {
    case "submitted": return "submitted";
    case "in_progress": return "writing";
    case "not_started": return "not_submitted";
    default: return "unknown";
  }
}

/** This screen's own path: where sign-in returns after a 401. */
export function rosterPath(courseId: string): string {
  return `/nastavnik/kolegiji/${encodeURIComponent(courseId)}/studenti`;
}

/** NZ-10: "Rok produljen do …" for an extended deadline of an unsubmitted work; null otherwise. */
export function extensionLine(work: RosterWork): string | null {
  if (work.status === "submitted") return null;
  const due = whenHr(work.extendedTo);
  return due === null ? null : text.extendedTo(due);
}

/** "Čeka doradu …" only for a request that still waits for the student; null otherwise. */
export function revisionLine(work: RosterWork): string | null {
  const r = work.revision;
  if (r === undefined || r === null || (r.state !== "open" && r.state !== "reopened")) return null;
  const due = whenHr(r.deadline);
  return due === null ? text.awaitsRevisionNoDeadline : text.awaitsRevision(due);
}

export function workLabel(work: RosterWork): string {
  return (work.workType !== null && text.workType[work.workType]) || work.title || text.fallbackWorkType;
}

/** The link to the live view only for a seminar paper with a document id (as the prototype). */
export function seminarDocumentId(work: RosterWork): string | null {
  const id = work.documentId;
  if (work.workType !== "seminar_paper" || typeof id !== "string" || id === "" || id === "." || id === "..") return null;
  return /^[\w-]+$/.test(id) ? id : null;
}

export type GroupOption = { readonly value: string; readonly label: string };

/** "Svi (n)" and "Grupa X (n)" in alphabetical order; empty when no student has a group. */
export function groupOptions(students: readonly RosterStudent[]): readonly GroupOption[] {
  const counts = new Map<string, number>();
  for (const s of students) if (s.group !== null && s.group !== "") counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
  if (counts.size === 0) return [];
  return [
    { value: "", label: `${text.allGroups} (${students.length})` },
    ...[...counts].sort(([a], [b]) => compareHr(a, b)).map(([value, n]) => ({ value, label: `${value} (${n})` })),
  ];
}

/** Alphabetical by name (no name last); never ordered by any figure. */
export function visibleStudents(students: readonly RosterStudent[], group: string): readonly RosterStudent[] {
  return students
    .filter((s) => group === "" || s.group === group)
    .slice()
    .sort((a, b) => (a.name === null ? (b.name === null ? 0 : 1) : b.name === null ? -1 : compareHr(a.name, b.name)));
}

// NZ-11 (WEB-NF4-KOLEGIJ): filters by state, order by surname or by state, and "Nije započelo n". Reading only:
// nothing here ranks students by a figure; the order by state is the order of what needs the teacher first.
export type StateFilter = "" | "notStarted" | "writing" | "submitted" | "late" | "revision";
export type StudentOrder = "surname" | "state";
export const STATE_FILTERS: readonly Exclude<StateFilter, "">[] = ["notStarted", "writing", "submitted", "late", "revision"];

/** Whether one work is in the state; "late" is a submitted work the server marked after the deadline. */
export function workInState(work: RosterWork, filter: Exclude<StateFilter, "">): boolean {
  switch (filter) {
    // NAS-08: "unconfirmed" is a work not started whose notice is not acknowledged; it stays in this filter and count.
    case "notStarted": return work.status === "not_submitted" || work.status === "unconfirmed";
    case "writing": return work.status === "writing";
    case "submitted": return work.status === "submitted";
    case "late": return work.status === "submitted" && work.afterDeadline === true;
    case "revision": return revisionLine(work) !== null;
  }
}

const inState = (student: RosterStudent, filter: StateFilter): boolean =>
  filter === "" || student.works.some((work) => workInState(work, filter));

/** "Svi (n)" and one option per state with the number of students in it; a state nobody is in stays listed with 0. */
export function stateOptions(students: readonly RosterStudent[]): readonly GroupOption[] {
  return [
    { value: "", label: `${text.allStates} (${students.length})` },
    ...STATE_FILTERS.map((value) => ({ value, label: `${text.stateFilter[value]} (${students.filter((s) => inState(s, value)).length})` })),
  ];
}

/** "Nije započelo n": the students with at least one work not started. */
export function notStartedCount(students: readonly RosterStudent[]): number {
  return students.filter((s) => inState(s, "notStarted")).length;
}

const surnameKey = (name: string): [string, string] => {
  const words = name.trim().split(/\s+/);
  return [words[words.length - 1] ?? "", words.slice(0, -1).join(" ")];
};
const compareName = (a: string | null, b: string | null): number => {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const [sa, fa] = surnameKey(a);
  const [sb, fb] = surnameKey(b);
  return compareHr(sa, sb) || compareHr(fa, fb);
};

/** What needs the teacher first: a request waiting for the student, then not started, writing, the rest. */
const needRank = (student: RosterStudent): number => {
  if (student.works.some((w) => revisionLine(w) !== null)) return 0;
  if (student.works.some((w) => w.status === "not_submitted")) return 1;
  if (student.works.some((w) => w.status === "writing")) return 2;
  return 3;
};

/** Group, state and order together; ties keep the order by surname. */
export function listedStudents(
  students: readonly RosterStudent[], group: string, state: StateFilter, order: StudentOrder,
): readonly RosterStudent[] {
  return students
    .filter((s) => (group === "" || s.group === group) && inState(s, state))
    .slice()
    .sort((a, b) => (order === "state" ? needRank(a) - needRank(b) : 0) || compareName(a.name, b.name));
}

/** A student or an assignment of one student twice makes the whole read unavailable. */
export function consistent(data: RosterData): boolean {
  const ids = data.students.map((s) => s.studentId);
  return new Set(ids).size === ids.length
    && data.students.every((s) => new Set(s.works.map((w) => w.assignmentId)).size === s.works.length);
}

/** Reads through the port; a failure or a contradictory answer is "unavailable", never an empty list. */
export async function loadRoster(port: CourseStudentsPort, courseId: string): Promise<RosterRead> {
  try {
    const read = await port.read(courseId);
    return read.kind === "ready" && !consistent(read.data) ? { kind: "unavailable" } : read;
  } catch {
    return { kind: "unavailable" };
  }
}
