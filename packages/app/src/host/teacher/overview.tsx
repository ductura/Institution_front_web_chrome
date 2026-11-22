"use client";

// HOST-T3 (graditelj, 20. 11. 2026.): the teacher's overviews in the host,
// read only through src/client. N-17 "Zbirni" (teacher.assignment-overview.get,
// handler SRV-29) and N-13 "Produljenje roka" (WEB-1113 over SRV-1108). A read
// that fails is said as such, never shown as an empty list.
import { appHref, readTeacherCourses, type TeacherCoursesCall } from "../../../../../src/components/index.ts";
import { createApi } from "../../../../../src/client/api.ts";
import { readDeadlineExtensions, readExtensionStudents, recordDeadlineExtension } from "../../../../../src/client/deadline-extensions.ts";
import { readAssignmentOverview, type TeacherCall } from "../../../../../src/client/teacher-reads.ts";

import N17Overview from "./n17/Overview";
import type { N17Port, N17Read } from "./n17/model";
import N13Extensions from "./n13/Extensions";
import type { N13Port, N13Read } from "./n13/model";

/** N-17 reads teacher.courses.get and then the overview of every assignment; one failed assignment fails only its card. */
const n17Port: N17Port = {
  async read(): Promise<N17Read> {
    const courses = await readTeacherCourses(createApi() as unknown as TeacherCoursesCall);
    if (courses.kind === "signedOut") return { kind: "signedOut" };
    if (courses.kind !== "ready") return { kind: "unavailable" };
    const cards = await Promise.all(courses.courses.flatMap((course) => course.assignments.map(async (a) => {
      const overview = await readAssignmentOverview(createApi() as unknown as TeacherCall, a.id);
      return { assignmentId: a.id, title: a.title, courseName: course.name, rows: overview.kind === "ready" ? overview.rows : null };
    })));
    return { kind: "ready", cards };
  },
};

/** N-17 "Zbirni pregled" (WEB-2149): a card per assignment, see ./n17. */
export function AssignmentOverviewPage() {
  return <N17Overview port={n17Port} />;
}

/** N-13 reads the extensions, the students and the task facts of teacher.courses.get; a part that fails is "unavailable", never empty. */
const n13Port: N13Port = {
  async read(assignmentId): Promise<N13Read> {
    const client = createApi();
    const [list, students, courses] = await Promise.all([
      readDeadlineExtensions(client, assignmentId), readExtensionStudents(client, assignmentId),
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
      },
    };
  },
  record: (assignmentId, draft) => recordDeadlineExtension(createApi(), assignmentId, draft),
};

/** N-13 "Produljenje roka" for one assignment (WEB-2162), see ./n13. */
export function DeadlineExtensionsPage({ assignmentId }: { assignmentId: string }) {
  return <N13Extensions assignmentId={assignmentId} port={n13Port} />;
}
