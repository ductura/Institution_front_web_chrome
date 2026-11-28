import { whenHr } from "../assignment-facts/model.ts";
import type { TeacherCourse } from "../../../../../../src/components/teacher/teacher-courses-read.ts";
import type { readAssignmentVersion } from "../../../../../../src/client/teacher-assignment.ts";
import type { TeachingTeamView } from "../../../../../../src/client/teaching-team.ts";
import { assignmentCardMessages as t } from "./messages.hr";

/** The caller's role in one course; "unknown" until the team view answers or when it cannot. */
export type CardRole = "holder" | "collaborator" | "unknown";

/** `holder` is the teaching-team view's holder; an assistant is the prototype's "suradnik" (read and comment only, INVENTAR §7 t. 5). */
export function roleOf(view: TeachingTeamView | null): CardRole {
  if (view === null) return "unknown";
  return view.role === "holder" ? "holder" : "collaborator";
}

/** `8. 11. 2026. u 23:59`, as the prototype writes it, in Europe/Zagreb; the raw text when the instant cannot be read. */
export function dueText(iso: string): string {
  return whenHr(iso) ?? iso;
}

/** The assignment whose deadline is the nearest one not yet passed, or null. */
export function nextDeadline(course: Pick<TeacherCourse, "assignments">, now: number): TeacherCourse["assignments"][number] | null {
  let best: TeacherCourse["assignments"][number] | null = null;
  let bestMs = Infinity;
  for (const assignment of course.assignments) {
    const ms = Date.parse(assignment.dueAt);
    if (Number.isNaN(ms) || ms < now || ms >= bestMs) continue;
    best = assignment;
    bestMs = ms;
  }
  return best;
}

/** "4 studenta, grupe 2 i 4", from the team view; null when the view is not there. */
export function enrolledText(view: TeachingTeamView | null): string | null {
  if (view === null) return null;
  const students = view.role === "holder" ? view.students.length : view.groups.reduce((sum, g) => sum + g.students.length, 0);
  const noun = students % 10 === 1 && students % 100 !== 11 ? t.students.one
    : students % 10 >= 2 && students % 10 <= 4 && (students % 100 < 12 || students % 100 > 14) ? t.students.few : t.students.many;
  const groups = view.groups.map((g) => g.name);
  return `${students} ${noun}${groups.length > 0 ? `, ${groups.join(", ")}` : ""}`;
}

// P-D1: teacher.courses.get has no practice flag; institution.assignment.get has `isPractice`.
export type AssignmentRead = Awaited<ReturnType<typeof readAssignmentVersion>>;
export type ReadAssignment = (assignmentId: string) => Promise<AssignmentRead>;

/** Only a ready read whose server answer says `isPractice: true` is practice. */
export function practiceOf(read: AssignmentRead): boolean {
  return read.kind === "ready" && read.value.isPractice === true;
}

/** The practice flag of each assignment, keyed by id; a read that throws counts as not practice. */
export async function readPractice(ids: readonly string[], read: ReadAssignment): Promise<ReadonlyMap<string, boolean>> {
  const flags = await Promise.all(ids.map((id) => read(id).then(practiceOf, () => false)));
  return new Map(ids.map((id, index) => [id, flags[index] === true]));
}

// NZ-1 and NZ-2 (WEB-NUZ-NZ): the entries of one assignment and the course's task chooser. Every path is a
// route of the host (src/routes.ts); none is invented here.
const task = (id: string, rest: string) => `/nastavnik/zadatak/${encodeURIComponent(id)}/${rest}`;

/** The screens one assignment is reached from the card: each one is a page of the host. */
export function taskPaths(assignmentId: string) {
  return {
    submissions: task(assignmentId, "predaje"),
    edit: task(assignmentId, "uredi"),
    copy: `${task(assignmentId, "uredi")}?kopiraj=1`,
    extension: task(assignmentId, "produljenje"),
    merlin: task(assignmentId, "merlin"),
    fastPath: `/nastavnik/brz-put?zadatak=${encodeURIComponent(assignmentId)}`,
  } as const;
}

/** "Zbirni pregled" of the card: the overview of this course's assignments only. */
export function courseOverviewPath(courseId: string): string {
  return `/nastavnik/zbirni?kolegij=${encodeURIComponent(courseId)}`;
}

export type TaskPick = "extension" | "merlin";

/** The chooser's option: "Naslov, rok 8. 11. 2026. u 23:59", or ", rok je prošao" (NZ-2: a passed deadline is offered too). */
export function taskOptionLabel(assignment: Pick<TeacherCourse["assignments"][number], "title" | "dueAt">, now: number): string {
  const ms = Date.parse(assignment.dueAt);
  return `${assignment.title}, ${!Number.isNaN(ms) && ms < now ? t.deadlinePassed : `${t.due.toLowerCase()} ${dueText(assignment.dueAt)}`}`;
}

/** Every assignment of the course, in the order of the read; none is left out for a passed deadline. */
export function taskOptions(course: Pick<TeacherCourse, "assignments">, now: number): readonly { value: string; label: string }[] {
  return course.assignments.map((a) => ({ value: a.id, label: taskOptionLabel(a, now) }));
}

/** The path the chooser goes to; null until a task of this course is chosen. */
export function pickedPath(course: Pick<TeacherCourse, "assignments">, pick: TaskPick, assignmentId: string): string | null {
  if (!course.assignments.some((a) => a.id === assignmentId)) return null;
  const paths = taskPaths(assignmentId);
  return pick === "extension" ? paths.extension : paths.merlin;
}

/** NZ-1: "Izdaj novi kod" of an empty course roster opens dk-h on that course's card. */
export function issueCodePath(courseId: string): string {
  return `/nastavnik?kod=${encodeURIComponent(courseId)}`;
}
