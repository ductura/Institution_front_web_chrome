import type { InstitutionCourse, PersonName, TeacherRoles } from "./reads";

/**
 * LOK-WEB-8: what the three screens show from their reads. A name stays in the nominative, given name
 * first; a person whose name the identity provider never gave is shown as such, never as an empty line
 * or an identifier. The read's order (by surname) is kept.
 */
export function displayName(name: PersonName, unnamed: string): string {
  return name === null ? unnamed : `${name.givenName} ${name.familyName}`;
}

/** The newest of the institution's own years (the list comes newest first), or the asked one when it is listed. */
export function chosenYear(years: readonly string[], asked: string | null): string | null {
  if (years.length === 0) return null;
  return asked !== null && years.includes(asked) ? asked : years[0]!;
}

/** "2026/2027" as the interface writes it: "2026./2027.". */
export function yearLabel(year: string): string {
  return year.split("/").map((part) => `${part}.`).join("/");
}

export type OverviewCounts = {
  confirmedTeachers: number;
  teacherCandidates: number;
  teachersWithoutAffiliation: number;
  courses: number;
  students: number;
};

/**
 * The counts of the institution from the three reads the contract gives (it has no overview route).
 * A candidate is a person on the roles' waiting list. Students are counted per course, as the read counts them.
 */
export function overviewCounts(roles: TeacherRoles, courses: readonly InstitutionCourse[]): OverviewCounts {
  return {
    confirmedTeachers: roles.confirmed.length,
    teacherCandidates: roles.pending.length,
    teachersWithoutAffiliation: roles.confirmed.filter((teacher) => teacher.forReview).length,
    courses: courses.length,
    students: courses.reduce((sum, course) => sum + course.students, 0),
  };
}
