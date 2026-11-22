import { whenHr } from "../assignment-facts/model.ts";
import type { TeacherCourse } from "../../../../../../src/components/teacher/teacher-courses-read.ts";
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

/** "4 studenta · grupe 2 i 4", from the team view; null when the view is not there. */
export function enrolledText(view: TeachingTeamView | null): string | null {
  if (view === null) return null;
  const students = view.role === "holder" ? view.students.length : view.groups.reduce((sum, g) => sum + g.students.length, 0);
  const noun = students % 10 === 1 && students % 100 !== 11 ? t.students.one
    : students % 10 >= 2 && students % 10 <= 4 && (students % 100 < 12 || students % 100 > 14) ? t.students.few : t.students.many;
  const groups = view.groups.map((g) => g.name);
  return `${students} ${noun}${groups.length > 0 ? ` · ${groups.join(", ")}` : ""}`;
}

/** The "Kod za upis" field: the server has no read-back (A-8), so only this visit's issues are known. */
export function codeFieldText(role: CardRole, issued: "now" | "before" | null): string {
  if (role === "collaborator") return t.codeHolderIssues;
  if (issued === "now") return t.codeIssuedNow;
  return issued === "before" ? t.codeIssuedBefore : t.codeUnknown;
}
