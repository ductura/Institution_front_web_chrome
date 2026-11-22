// WEB-2103 (paritet E-3/E-4): what the two pages show of the reads. Pure
// functions over what student.assignments.get and student.assignment-work.get
// returned; nothing is guessed (no submit time, no state the reads do not prove).
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

/** The deadline in force: an extension replaces the original. */
export function effectiveDue(dueAt: string, extendedDueAt: string | null | undefined): string {
  return typeof extendedDueAt === "string" && extendedDueAt !== "" ? extendedDueAt : dueAt;
}
