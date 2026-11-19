import { RouteLoading } from "@ductura/ui";
import { createElement as h, Suspense, use, type ReactElement } from "react";

import { messagesHr } from "../../../locales/hr.ts";
import { zagrebParts } from "../summary/zagreb-time.ts";

import ErrorScreen from "../shell/ErrorScreen";

import { courseMotif } from "./course-motif";
import type { MyAssignmentsRead, MyCourse } from "./my-assignments-read";
import styles from "./MyAssignments.module.css";
import StudentHome from "./StudentHome";

const t = messagesHr.student.assignments;
const home = messagesHr.student.home;

/** `Rok: 30. studenoga 2026. u 23:59`, always in Europe/Zagreb, as on the teacher's list. */
function dueHr(iso: string): string {
  const parts = zagrebParts(iso);
  return home.due.replace("{time}", parts === null ? iso : `${parts.date} ${messagesHr.teacherCourses.at} ${parts.time}`);
}

/**
 * #711 contract 6404612273 as the Archivum course cards of S01 (DAN-344): one
 * card per own course with its decorative motif, and in it the assignments
 * of the current version. Only what the read returns: no work state, mentor
 * or edit time. "Pročitaj upute" when the current version's notice is not
 * acknowledged, else "Otvori zadatak"; both go to /rad, which decides access
 * and sends an unacknowledged notice to /zadatak/<id> (PRODUCT §5 rule 6).
 * The list arrives ordered from the read and is drawn as it comes. Written
 * with `createElement`, like TeacherCourses, so unit tests need no JSX compiler.
 * `level` is the course name's heading level: h3 under the "Moji kolegiji" h2
 * of S01, h2 right under the page h1 of S02, so no heading level is skipped.
 */
type ListProps = { courses: readonly MyCourse[]; level?: 2 | 3 };
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

function list({ courses, level = 3 }: ListProps) {
  return h("div", { className: styles.grid },
    courses.map((course) =>
      h("section", { key: course.id, className: styles.course, "aria-labelledby": `kolegij-${course.id}` },
        h("header", { className: styles.head, "data-motif": courseMotif(course.id) },
          h("p", { className: styles.eyebrow }, home.courseLabel),
          h(`h${level}`, { id: `kolegij-${course.id}`, className: styles.courseName }, course.name)),
        course.assignments.length === 0
          ? h("p", { className: styles.none }, t.noAssignments)
          : h("ul", { className: styles.assignments },
            course.assignments.map((assignment) =>
              h("li", { key: assignment.id },
                h("a", { className: styles.assignment, href: `/rad?zadatak=${assignment.id}` },
                  h("span", { className: styles.title }, assignment.title),
                  h("span", { className: styles.bottom },
                    h("span", { className: styles.due }, dueHr(assignment.dueAt)),
                    h("span", { className: styles.action },
                      assignment.noticeFirst ? home.readNotice : home.open,
                      h("span", { "aria-hidden": "true", className: styles.arrow }, "→"))))))))));
}
