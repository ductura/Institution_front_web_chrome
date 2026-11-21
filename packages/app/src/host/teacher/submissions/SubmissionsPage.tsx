"use client";

import { appHref } from "../../../../../../src/components/index.ts";
import { readTeacherCourses, type TeacherCoursesCall } from "../../../../../../src/components/teacher/teacher-courses-read";
import { createApi } from "../../../../../../src/client/api.ts";
import { readAssignmentOverview, type TeacherCall } from "../../../../../../src/client/teacher-reads";
import { readAssignmentSubmissions, type SubmissionsCall } from "../../../../../../src/client/teacher-submissions";

import { useHost } from "../../context";
import { TeacherPage, useTeacherRead } from "../../pages";
import { submissionsMessages as t } from "./messages.hr";
import { buildRows, type TableRow } from "./model";
import SubmissionsTable from "./SubmissionsTable";

type Detail = { title: string; rows: TableRow[] };

/** The detail of one assignment (M7.2): who submitted, which revision, when, and whether after the deadline. */
export function SubmissionsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const [read, retry] = useTeacherRead<Detail>(base, async () => {
    const client = createApi();
    const [submissions, overview, courses] = await Promise.all([
      readAssignmentSubmissions(client as unknown as SubmissionsCall, assignmentId),
      readAssignmentOverview(client as unknown as TeacherCall, assignmentId),
      readTeacherCourses(client as unknown as TeacherCoursesCall),
    ]);
    if (submissions.kind !== "ready") return submissions;
    if (overview.kind === "session-expired") return { kind: "signedOut" };
    const title = courses.kind === "ready"
      ? courses.courses.flatMap((c) => c.assignments).find((a) => a.id === assignmentId)?.title ?? ""
      : "";
    return { kind: "ready", value: { title, rows: buildRows(submissions.rows, overview.kind === "ready" ? overview.rows : null) } };
  });
  return (
    <TeacherPage title={t.title} lead={t.lead} read={read} retry={retry} unavailable={t.unavailable} retryLabel={t.retry}
      ready={({ title, rows }) => (
        <>
          <SubmissionsTable assignmentTitle={title} rows={rows} href={(path) => appHref(base, path)} />
          <p><a href={appHref(base, `/nastavnik/zbirni?zadatak=${encodeURIComponent(assignmentId)}`)}>{t.back}</a></p>
        </>
      )} />
  );
}
