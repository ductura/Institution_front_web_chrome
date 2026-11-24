import type { MyCourse } from "./assignments";
import type { WorkState } from "./works";

/**
 * WEB-2113: the student host's own copy of what "Moji radovi" needs from
 * src/components/student/radovi/works-view.ts. Pure functions over what the
 * server returned: a filter only narrows that set, never adds to it and never
 * asks the server again.
 */

/** One assignment of one own course: the row of a work. */
export type WorkItem = {
  assignmentId: string;
  title: string;
  courseName: string;
  /** `2026/2027`, or "" when the read gave none. */
  academicYear: string;
  dueAt: string;
  extendedDueAt: string | null;
  noticeFirst: boolean;
  /** null: the state read did not answer for this work. */
  state: WorkState | null;
};

export type WorksFilter = {
  /** Words of the title or course name; blank keeps every item. */
  q: string;
  /** An academic year (`2026/2027`); blank keeps every year. */
  year: string;
};

/** Every assignment of every course, in the order of the read. */
export function worksOf(courses: readonly MyCourse[], states?: ReadonlyMap<string, WorkState> | null): WorkItem[] {
  return courses.flatMap((course) => course.assignments.map((assignment) => ({
    assignmentId: assignment.id,
    title: assignment.title,
    courseName: course.name,
    academicYear: course.academicYear ?? "",
    dueAt: assignment.dueAt,
    extendedDueAt: typeof assignment.extendedDueAt === "string" && assignment.extendedDueAt !== "" ? assignment.extendedDueAt : null,
    noticeFirst: assignment.noticeFirst,
    state: states?.get(assignment.id) ?? null,
  })));
}

const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("hr");

/** The items that match every word of `q` and the year; the order of the read is kept. */
export function filterWorks(items: readonly WorkItem[], { q, year }: WorksFilter): WorkItem[] {
  const words = fold(q).split(/\s+/u).filter((word) => word !== "");
  return items.filter((item) => {
    if (year !== "" && item.academicYear !== year) return false;
    const text = fold(`${item.title} ${item.courseName}`);
    return words.every((word) => text.includes(word));
  });
}

/** The academic years of the items, newest first; none the read did not return. */
export function yearsOf(items: readonly WorkItem[]): string[] {
  return [...new Set(items.map((item) => item.academicYear).filter((year) => year !== ""))].sort().reverse();
}
