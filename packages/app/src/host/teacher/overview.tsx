"use client";

// HOST-T3 (graditelj, 20. 11. 2026.): the teacher's overviews in the host,
// read only through src/client. N-17 "Zbirni" (teacher.assignment-overview.get,
// handler SRV-29) and N-13 "Produljenje roka" (WEB-1113 over SRV-1108). A read
// that fails is said as such, never shown as an empty list.
import { Button, Select } from "@ductura/ui";
import { useRouter, useSearchParams } from "next/navigation";

import { appHref, readTeacherCourses, type TeacherCoursesCall } from "../../../../../src/components/index.ts";
import AssignmentOverview from "../../../../../src/components/teacher/AssignmentOverview.tsx";
import { chooseAssignment, type OverviewChoice } from "../../../../../src/components/teacher/assignment-overview-choice.ts";
import DeadlineExtensions, { type ExtensionsRead } from "../../../../../src/components/teacher/deadline-extensions/DeadlineExtensions.tsx";
import { extensionsHref } from "../../../../../src/components/teacher/links.ts";
import { createApi } from "../../../../../src/client/api.ts";
import { readDeadlineExtensions, readExtensionStudents, type ExtensionStudent } from "../../../../../src/client/deadline-extensions.ts";
import { readAssignmentOverview, type OverviewRow, type TeacherCall } from "../../../../../src/client/teacher-reads.ts";
import { messagesHr } from "../../../../../src/lib/i18n/messages.hr.ts";

import { TeacherPage, useTeacherRead, type TeacherRead } from "../pages";
import { nextPath } from "../../bases";
import { useHost } from "../context";

const summary = messagesHr.teacherSummary;
const extensions = messagesHr.deadlineExtensions;

type Overview = { choices: OverviewChoice[]; chosen: OverviewChoice | null; rows: readonly OverviewRow[] | null };

/** N-17 "Zbirni": the teacher picks an assignment of teacher.courses.get and sees its submissions. */
export function AssignmentOverviewPage() {
  const { base } = useHost();
  const router = useRouter();
  const asked = useSearchParams().get("zadatak") ?? undefined;
  const [read, retry] = useTeacherRead<Overview>(base, async () => {
    const courses = await readTeacherCourses(createApi() as unknown as TeacherCoursesCall);
    if (courses.kind !== "ready") return courses;
    const choices = courses.courses.flatMap((course) => course.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      label: summary.assignmentOption.replace("{course}", course.name).replace("{assignment}", a.title),
    })));
    const chosen = chooseAssignment(choices, asked);
    if (chosen === null) return { kind: "ready", value: { choices, chosen, rows: [] } };
    const overview = await readAssignmentOverview(createApi() as unknown as TeacherCall, chosen.id);
    if (overview.kind === "session-expired") return { kind: "signedOut" };
    return { kind: "ready", value: { choices, chosen, rows: overview.kind === "ready" ? overview.rows : null } };
  });
  return (
    <TeacherPage title={summary.title} lead={summary.lead} read={read} retry={retry}
      unavailable={summary.unavailable} retryLabel={summary.retry}
      ready={({ choices, chosen, rows }) => chosen === null ? (
        <section aria-labelledby="zbirni-prazno">
          <h2 id="zbirni-prazno">{summary.emptyTitle}</h2>
          <p role="status">{summary.emptyBody}</p>
        </section>
      ) : (
        <>
          <form onSubmit={(e) => {
            e.preventDefault();
            const id = new FormData(e.currentTarget).get("zadatak");
            if (typeof id === "string") router.push(nextPath(base, `/nastavnik/zbirni?zadatak=${encodeURIComponent(id)}`));
          }}>
            <Select name="zadatak" label={summary.pickLabel} defaultValue={chosen.id}
              options={choices.map((c) => ({ value: c.id, label: c.label }))} />
            <Button type="submit">{summary.pickSubmit}</Button>
          </form>
          <p><a href={appHref(base, extensionsHref(chosen.id))}>{summary.extendDeadline}</a></p>
          <AssignmentOverview assignmentTitle={chosen.title} rows={rows} />
        </>
      )} />
  );
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
    <TeacherPage title={extensions.title} lead={extensions.lead} read={read} retry={retry}
      unavailable={extensions.unavailable} retryLabel={extensions.retry}
      ready={(value) => <DeadlineExtensions assignmentId={assignmentId} read={value.read} students={value.students}
        onRecorded={retry} returnTo={appHref(base, extensionsHref(assignmentId))} />} />
  );
}
