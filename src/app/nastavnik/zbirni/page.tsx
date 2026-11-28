import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button, Select } from "@ductura/ui";

import { signInHref } from "../../../client/api";
import { serverApi } from "../../../client/server";
import { readAssignmentOverview, type TeacherCall } from "../../../client/teacher-reads";
import AssignmentOverview from "../../../components/teacher/AssignmentOverview";
import { chooseAssignment, type OverviewChoice } from "../../../components/teacher/assignment-overview-choice";
import { extensionsHref } from "../../../components/teacher/links";
import { readTeacherCourses } from "../../../components/teacher/teacher-courses-read";
import { messagesHr } from "../../../lib/i18n/messages.hr";

import styles from "../page.module.css";

const t = messagesHr.teacherSummary;
const HREF = "/nastavnik/zbirni";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title}, ${messagesHr.app.name}` };

/**
 * TODO(ugovor): teacher.assignment-overview.get comes with
 * @ductura/contracts 3.2.0 (SRV-27, SRV-32) and its handler with SRV-29. Until
 * src/client (lane W-A) gives it a transport, the read is not wired and the
 * page says the overview is unavailable: never an empty or invented list.
 */
const overviewCall: TeacherCall = async () => ({ ok: false, status: 503, code: "not_wired" });

function hrefFor(assignmentId: string): string {
  return `${HREF}?zadatak=${encodeURIComponent(assignmentId)}`;
}

/**
 * `/nastavnik/zbirni` (WEB-33, N-17): the teacher picks one of the
 * assignments of teacher.courses.get and sees its submissions, a row per
 * student (AssignmentOverview). The shell (layout) has already read the
 * session and the role.
 */
export default async function TeacherSummaryPage({ searchParams }: { searchParams: Promise<{ zadatak?: string | string[] }> }) {
  const server = serverApi((await cookies()).toString());
  const courses = await readTeacherCourses(server);
  if (courses.kind === "signedOut") redirect(signInHref(HREF));

  let body;
  if (courses.kind !== "ready") {
    body = <AssignmentOverview assignmentTitle="" rows={null} retryHref={HREF} />;
  } else {
    const choices: OverviewChoice[] = courses.courses.flatMap((course) => course.assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      label: t.assignmentOption.replace("{course}", course.name).replace("{assignment}", assignment.title),
    })));
    const chosen = chooseAssignment(choices, (await searchParams).zadatak);
    if (chosen === null) {
      body = (
        <section aria-labelledby="zbirni-prazno">
          <h2 id="zbirni-prazno">{t.emptyTitle}</h2>
          <p role="status">{t.emptyBody}</p>
        </section>
      );
    } else {
      const overview = await readAssignmentOverview(overviewCall, chosen.id);
      if (overview.kind === "session-expired") redirect(signInHref(hrefFor(chosen.id)));
      body = (
        <>
          <form method="get" className={styles.head}>
            <Select name="zadatak" label={t.pickLabel} defaultValue={chosen.id}
              options={choices.map((choice) => ({ value: choice.id, label: choice.label }))} />
            <Button type="submit">{t.pickSubmit}</Button>
          </form>
          <p><a href={extensionsHref(chosen.id)}>{t.extendDeadline}</a></p>
          <AssignmentOverview assignmentTitle={chosen.title} retryHref={hrefFor(chosen.id)}
            rows={overview.kind === "ready" ? overview.rows : null} />
        </>
      );
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <h1>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
        </div>
      </div>
      {body}
    </div>
  );
}
