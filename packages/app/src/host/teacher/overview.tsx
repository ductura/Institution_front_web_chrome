"use client";

// HOST-T3 (graditelj, 20. 11. 2026.): the teacher's overviews in the host,
// read only through src/client. N-17 "Zbirni" (teacher.assignment-overview.get,
// handler SRV-29) and N-13 "Produljenje roka" (WEB-1113 over SRV-1108). A read
// that fails is said as such, never shown as an empty list.
import { appHref, readTeacherCourses, type TeacherCoursesCall } from "../../../../../src/components/index.ts";
import DeadlineExtensions, { type ExtensionsRead } from "../../../../../src/components/teacher/deadline-extensions/DeadlineExtensions.tsx";
import { extensionsHref } from "../../../../../src/components/teacher/links.ts";
import { createApi } from "../../../../../src/client/api.ts";
import { readDeadlineExtensions, readExtensionStudents, type ExtensionStudent } from "../../../../../src/client/deadline-extensions.ts";
import { readAssignmentOverview, type TeacherCall } from "../../../../../src/client/teacher-reads.ts";
import { messagesHr } from "../../../../../src/lib/i18n/messages.hr.ts";

import { TeacherPage, useTeacherRead, type TeacherRead } from "../pages";
import N17Overview from "./n17/Overview";
import type { N17Port, N17Read } from "./n17/model";
import { teacherShellHr } from "./shell/messages.hr";
import { useHost } from "../context";

const extensions = messagesHr.deadlineExtensions;

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

type Extensions = { read: ExtensionsRead; students: readonly ExtensionStudent[] | null };

/** N-13 "Produljenje roka" for one assignment (WEB-1113). */
export function DeadlineExtensionsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const [read, retry] = useTeacherRead<Extensions>(base, async (): Promise<TeacherRead<Extensions>> => {
    const client = createApi();
    const [list, students] = await Promise.all([readDeadlineExtensions(client, assignmentId), readExtensionStudents(client, assignmentId)]);
    if (list.kind === "session-expired") return { kind: "signedOut" };
    const extensionsRead: ExtensionsRead = list.kind === "ready" ? { kind: "ready", extensions: list.extensions } : { kind: "unavailable" };
    return { kind: "ready", value: { read: extensionsRead, students } };
  });
  return (
    <TeacherPage title={extensions.title} lead={extensions.lead} loading={teacherShellHr.loadingExtensions} read={read} retry={retry}
      unavailable={extensions.unavailable} retryLabel={extensions.retry}
      ready={(value) => <DeadlineExtensions assignmentId={assignmentId} read={value.read} students={value.students}
        onRecorded={retry} returnTo={appHref(base, extensionsHref(assignmentId))} />} />
  );
}
