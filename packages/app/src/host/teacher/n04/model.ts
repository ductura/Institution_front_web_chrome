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
export type RevisionState = "open" | "reopened" | "accepted" | "closed";

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
