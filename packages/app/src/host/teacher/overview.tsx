"use client";

// HOST-T3 (graditelj, 20. 11. 2026.): the teacher's overviews in the host,
// read only through src/client. N-17 "Zbirni" (teacher.assignment-overview.get,
// handler SRV-29, joined in WEB-NUZ-NZ NZ-10 with teacher.course-students.get,
// teacher.submissions.get and teacher.deadline-extensions.get) and N-13
// "Produljenje roka" (WEB-1113 over SRV-1108). A read that fails is said as
// such, never shown as an empty list.
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { appHref, readTeacherCourses, type TeacherCoursesCall } from "../../../../../src/components/index.ts";
import { createApi } from "../../../../../src/client/api.ts";
import { readDeadlineExtensions, readExtensionStudents, recordDeadlineExtension } from "../../../../../src/client/deadline-extensions.ts";
import { readAssignmentOverview, type TeacherCall } from "../../../../../src/client/teacher-reads.ts";
import { createTeachingTeam } from "../../../../../src/client/teaching-team.ts";
import { readStudentAccommodations, type AccommodationCall } from "../../../../../src/client/work-accommodation.ts";

import { roleOf, type CardRole } from "./assignment-card/model";
import { followUp } from "./assignment-facts/read";

import N17Overview from "./n17/Overview";
import { joinRows, type N17Port, type N17Read, type RowJoin } from "./n17/model";
import N13Extensions from "./n13/Extensions";
import type { N13Port, N13Read } from "./n13/model";
import { readExtensionSubmissions, type SubmissionsCall } from "./n13/submissions";

export type OverviewCall = ReturnType<typeof createApi>;
/** `?kolegij=` and `?zadatak=` of the page: the overview of one course or one assignment (NZ-2). */
export type OverviewScope = { readonly course: string | null; readonly task: string | null };
const none = { query: undefined, body: undefined } as const;

/** teacher.course-students.get of one course, as the works of each assignment by student; null when it fails. */
async function courseWorks(call: OverviewCall, courseId: string): Promise<ReadonlyMap<string, NonNullable<RowJoin["works"]>> | null> {
  const answer = await call("teacher.course-students.get", { params: { courseId }, ...none }).catch(() => null);
  if (answer === null || !answer.ok) return null;
  const byTask = new Map<string, Map<string, { state: "not_started" | "in_progress" | "submitted"; documentId: string | null }>>();
  for (const student of answer.body.students) {
    for (const work of student.assignments) {
      const map = byTask.get(work.assignmentId) ?? new Map();
      map.set(student.studentId, { state: work.workState, documentId: work.documentId });
      byTask.set(work.assignmentId, map);
    }
  }
  return byTask;
}

/** The caller's role in one course (holder or collaborator); "unknown" when the team view cannot be read. */
async function roleIn(call: OverviewCall, courseId: string): Promise<CardRole> {
  const answer = await createTeachingTeam(courseId, call).read().catch(() => null);
  return roleOf(answer?.kind === "ready" ? answer.view : null);
}

/** teacher.submissions.get of one assignment, by student; null when it fails. */
async function submissionsOf(call: OverviewCall, assignmentId: string): Promise<RowJoin["submissions"]> {
  const answer = await call("teacher.submissions.get", { params: { assignmentId }, ...none }).catch(() => null);
  if (answer === null || !answer.ok) return null;
  return new Map(answer.body.submissions.map((s) => [s.studentId, { revision: s.revision, documentId: s.documentId }]));
}

/**
 * N-17 reads teacher.courses.get and then, per assignment, the overview (the rows) joined with the course's
 * students, the submissions and the extensions (NZ-10). One failed overview fails only its card; another
 * failed read only leaves its fields as "nedostupno". An unknown `?kolegij=` shows every course, and a known
 * `?zadatak=` only that assignment (NZ-2).
 */
export function overviewPort(scope: OverviewScope = { course: null, task: null }, client: () => OverviewCall = () => createApi()): N17Port {
  return {
    async read(): Promise<N17Read> {
      const call = client();
      const courses = await readTeacherCourses(call as unknown as TeacherCoursesCall);
      if (courses.kind === "signedOut") return { kind: "signedOut" };
      if (courses.kind !== "ready") return { kind: "unavailable" };
      const one = courses.courses.find((c) => c.id === scope.course);
      const chosen = one === undefined ? courses.courses : [one];
      const now = Date.now();
      // `?zadatak=` narrows every chosen course to that assignment; a course without it shows no card. Only an
      // assignment that none of the chosen courses has (a stale link) falls back to all of their assignments.
      const known = scope.task !== null && chosen.some((course) => course.assignments.some((a) => a.id === scope.task));
      const cards = await Promise.all(chosen.flatMap((course) => {
        const tasks = known ? course.assignments.filter((a) => a.id === scope.task) : course.assignments;
        if (tasks.length === 0) return [];
        const works = courseWorks(call, course.id);
        const role = roleIn(call, course.id);
        return tasks.map(async (a) => {
          const [overview, byTask, submissions, extensions, cardRole, follow] = await Promise.all([
            readAssignmentOverview(call as unknown as TeacherCall, a.id), works, submissionsOf(call, a.id), readDeadlineExtensions(call, a.id), role, followUp(call, a.id),
          ]);
          // F4-PM2-R08 (D-50): the accommodation mark of each student's work, after the rows say who is there.
          const accommodations = overview.kind === "ready" && overview.rows.length > 0
            ? await readStudentAccommodations(call as unknown as AccommodationCall, a.id, overview.rows.map((r) => r.studentId))
            : null;
          const join: RowJoin = {
            dueAt: a.dueAt,
            works: byTask === null ? null : byTask.get(a.id) ?? new Map(),
            submissions,
            extensions: extensions.kind === "ready" ? extensions.extensions : null,
            followUp: follow,
            accommodations,
          };
          return {
            assignmentId: a.id, title: a.title, courseName: course.name, courseId: course.id, dueAt: a.dueAt, role: cardRole,
            rows: overview.kind === "ready" ? joinRows(overview.rows, join, now) : null,
            ...(overview.kind === "ready" && overview.rows.length > 0 && accommodations === null ? { accommodationsUnavailable: true } : {}),
          };
        });
      }));
      return { kind: "ready", cards, ...(one === undefined ? {} : { course: one.name }) };
    },
  };
}

/** N-17 "Zbirni pregled" (WEB-2149): a card per assignment, see ./n17; `?kolegij=` narrows it to one course (NZ-2). */
export function AssignmentOverviewPage() {
  const query = useSearchParams();
  const course = query.get("kolegij");
  const task = query.get("zadatak");
  const port = useMemo(() => overviewPort({ course, task }), [course, task]);
  return <N17Overview port={port} />;
}

/** N-13 reads the extensions, the students and the task facts of teacher.courses.get; a part that fails is "unavailable", never empty. */
const n13Port: N13Port = {
  async read(assignmentId): Promise<N13Read> {
    const client = createApi();
    const [list, students, submissions, courses] = await Promise.all([
      readDeadlineExtensions(client, assignmentId), readExtensionStudents(client, assignmentId),
      readExtensionSubmissions(createApi() as unknown as SubmissionsCall, assignmentId),
      readTeacherCourses(createApi() as unknown as TeacherCoursesCall),
    ]);
    if (list.kind === "session-expired") return { kind: "signedOut" };
    const course = courses.kind === "ready" ? courses.courses.find((c) => c.assignments.some((a) => a.id === assignmentId)) : undefined;
    const task = course?.assignments.find((a) => a.id === assignmentId);
    return {
      kind: "ready",
      data: {
        context: { task: task?.title ?? null, course: course?.name ?? null, dueAt: task?.dueAt ?? null },
        extensions: list.kind === "ready" ? list.extensions : null,
        students,
        submissions,
      },
    };
  },
  record: (assignmentId, draft) => recordDeadlineExtension(createApi(), assignmentId, draft),
};

/** N-13 "Produljenje roka" for one assignment (WEB-2162), see ./n13. */
export function DeadlineExtensionsPage({ assignmentId }: { assignmentId: string }) {
  return <N13Extensions assignmentId={assignmentId} port={n13Port} />;
}
