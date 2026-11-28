import { RouteLoading } from "@ductura/ui";
import { createElement as h, Suspense, use, type ReactElement, type ReactNode } from "react";

import { messagesHr } from "../../../locales/hr.ts";
import { messagesHr as webHr } from "../../lib/i18n/messages.hr";
import { zagrebParts } from "../summary/zagreb-time.ts";

import ErrorScreen from "../shell/ErrorScreen";

import { courseMotif } from "./course-motif";
import type { CourseTeacher, MyAssignment, MyAssignmentsRead, MyCourse } from "./my-assignments-read";
import styles from "./MyAssignments.module.css";
import StudentHome from "./StudentHome";

const t = messagesHr.student.assignments;
const home = messagesHr.student.home;
// WEB-09: the text of the fields A-3 added; the server's locales/ copy has none yet.
const added = webHr.student.home;

/**
 * `Rok: 30. studenoga 2026. u 23:59`, always in Europe/Zagreb, as on the teacher's list.
 * Design alignment 27. 11. 2026. (A6): a time that cannot be read is left out, never shown raw.
 */
function dueHr(iso: string, label: string = home.due): string | null {
  const parts = zagrebParts(iso);
  return parts === null ? null : label.replace("{time}", `${parts.date} ${messagesHr.teacherCourses.at} ${parts.time}`);
}

/** WEB-09 (A-3): an extended deadline, when there is one, replaces the deadline shown; the original is not repeated. */
function deadline(assignment: MyAssignment): string | null {
  const extended = assignment.extendedDueAt;
  return typeof extended === "string" && extended !== "" ? dueHr(extended, added.extendedDue) : dueHr(assignment.dueAt);
}

/** The contract's `2026/2027` as written in Croatian, `2026./2027.`; anything else as it came. */
function academicYearHr(year: string): string {
  const match = /^(\d{4})\/(\d{4})$/.exec(year);
  return match === null ? year : `${match[1]}./${match[2]}.`;
}

/** `Iva Horvat (nositelj), Ana Kovač (suradnik)`, in the order the read returns them. */
function teacherNames(teachers: readonly CourseTeacher[]): string {
  return teachers.map((teacher) => `${teacher.givenName} ${teacher.familyName} (${added.teacherRole[teacher.role]})`).join(", ");
}

/**
 * #711 contract 6404612273 as the Archivum course cards of S01 (DAN-344): one
 * card per own course with its decorative motif, and in it the assignments
 * of the current version. Only what the read returns: no work state, mentor
 * or edit time. "Pročitaj upute" when the current version's notice is not
 * acknowledged, else "Otvori zadatak"; both go to /rad (`assignmentHref`), which decides access
 * and sends an unacknowledged notice to /zadatak/<id> (PRODUCT §5 rule 6).
 * The list arrives ordered from the read and is drawn as it comes. Written
 * with `createElement`, like TeacherCourses, so unit tests need no JSX compiler.
 * `level` is the course name's heading level: h3 under the "Moji kolegiji" h2
 * of S01, h2 right under the page h1 of S02, so no heading level is skipped.
 */
type ListProps = { courses: readonly MyCourse[]; level?: 2 | 3; assignmentHref?: AssignmentHref; assignmentAction?: AssignmentAction };

/**
 * WEB-1402: an action the host draws on an assignment's card under its link (the
 * Next host's "Započni rad"). Null, or no prop, draws nothing: the card is as before.
 */
export type AssignmentAction = (assignment: MyAssignment) => ReactNode;

/** Where an assignment opens. Each host routes its own: the Vite host keeps `/rad?zadatak=`. */
export type AssignmentHref = (assignmentId: string) => string;

/** The address the Vite host (packages/app) routes; the Next page passes `/rad/<id>` (WEB-09). */
export const legacyAssignmentHref: AssignmentHref = (id) => `/rad?zadatak=${id}`;
/**
 * DAN-876: the S02 page body over student.assignments.get. `read` is
 * readMyAssignments(createApi()), made once by the page, outside render; it
 * never rejects. `signIn` as in StudentHome (D-09).
 */
type ReadProps = { read: Promise<MyAssignmentsRead>; signIn: (returnTo: string) => string };

export default function MyAssignments(props: ListProps | ReadProps): ReactElement {
  if ("read" in props) {
    return h(Suspense, { fallback: h(RouteLoading, { label: messagesHr.workspace.panelLoading }) }, h(Settled, props));
  }
  return list(props);
}

/**
 * Unavailable is ErrorScreen, the page's only h1. A list and signed out are
 * StudentHome's own S02 states, so signing in stays the AAI@EduHr link.
 */
function Settled({ read, signIn }: ReadProps): ReactElement {
  const settled = use(read);
  if (settled.kind === "unavailable") return h(ErrorScreen, { title: home.unavailableHeading, body: home.unavailableBody });
  return h("main", { id: "sadrzaj", tabIndex: -1, className: "page" },
    h(StudentHome, { read: settled, enroll: null, signIn, view: "courses" }));
}

function list({ courses, level = 3, assignmentHref = legacyAssignmentHref, assignmentAction }: ListProps) {
  return h("div", { className: styles.grid },
    courses.map((course) =>
      h("section", { key: course.id, className: styles.course, "aria-labelledby": `kolegij-${course.id}` },
        h("header", { className: styles.head, "data-motif": courseMotif(course.id) },
          // Design alignment 27. 11. 2026. (A4): label and year are separate parts, 12 px apart, no dot.
          h("p", { className: styles.eyebrow },
            h("span", null, home.courseLabel),
            course.academicYear ? h("span", null, academicYearHr(course.academicYear)) : null),
          h(`h${level}`, { id: `kolegij-${course.id}`, className: styles.courseName }, course.name)),
        // Under the header, clear of the motif, so the names stay legible.
        course.teachers && course.teachers.length > 0
          ? h("p", { className: styles.teachers }, `${added.teachers}: ${teacherNames(course.teachers)}`)
          : null,
        course.assignments.length === 0
          ? h("p", { className: styles.none }, t.noAssignments)
          : h("ul", { className: styles.assignments },
            course.assignments.map((assignment) =>
              h("li", { key: assignment.id },
                h("a", { className: styles.assignment, href: assignmentHref(assignment.id) },
                  h("span", { className: styles.title }, assignment.title),
                  h("span", { className: styles.bottom },
                    deadline(assignment) === null ? null : h("span", { className: styles.due }, deadline(assignment)),
                    h("span", { className: styles.action },
                      assignment.noticeFirst ? home.readNotice : home.open,
                      h("span", { "aria-hidden": "true", className: styles.arrow }, "→")))),
                assignmentAction?.(assignment) ?? null))))));
}
