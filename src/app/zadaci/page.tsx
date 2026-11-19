import { headers } from "next/headers";

import { serverApi } from "../../client/server";
import RoleShell, { signInPage } from "../../components/shell/RoleShell";
import { readMyAssignments } from "../../components/student/my-assignments-read";
import StudentHome from "../../components/student/StudentHome";
import { messagesHr as t } from "../../lib/i18n/messages.hr";

// The session cookie is read per request: nothing of a student's list is built in.
export const dynamic = "force-dynamic";
export const metadata = { title: `${t.student.assignments.title} · ${t.app.name}` };

const HERE = "/zadaci";

/** The Next route of a work (WEB-14); it sends an unacknowledged notice first. */
const workHref = (assignmentId: string) => `/rad/${encodeURIComponent(assignmentId)}`;

/**
 * The list, read only once RoleShell has found a session with a role: signed
 * out never reaches student.assignments.get. A 401 between the two reads is
 * StudentHome's signed-out state, with the AAI@EduHr sign-in back here (D-09).
 */
async function Assignments() {
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const read = await readMyAssignments(serverApi(cookie));
  // Enrolling by code is /upis (WEB-11); the empty state leads there.
  const enroll = (
    <p>
      <a className="btn" href="/upis">{t.student.home.enrollLink}</a>
    </p>
  );
  return (
    <div className="page">
      <StudentHome read={read} enroll={enroll} signIn={signInPage} assignmentHref={workHref} />
    </div>
  );
}

/**
 * S: E-2 "Moji zadaci" (WEB-09, A-1): the student's courses with their
 * assignments, deadlines and teachers, from student.assignments.get through
 * src/client with the request's session cookie. No database access here.
 */
export default function MyAssignmentsPage() {
  return (
    <RoleShell here={HERE} current={HERE} crumbs={[t.student.assignments.title]}>
      <Assignments />
    </RoleShell>
  );
}
