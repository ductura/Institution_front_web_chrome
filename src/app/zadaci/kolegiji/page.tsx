import { headers } from "next/headers";

import { serverApi } from "../../../client/server";
import RoleShell, { signInPage } from "../../../components/shell/RoleShell";
import { readMyAssignments } from "../../../components/student/my-assignments-read";
import StudentHome from "../../../components/student/StudentHome";
import { messagesHr as t } from "../../../lib/i18n/messages.hr";

// The session cookie is read per request: nothing of a student's list is built in.
export const dynamic = "force-dynamic";
export const metadata = { title: `${t.student.home.courses} · ${t.app.name}` };

const HERE = "/zadaci/kolegiji";

/** The Next route of a work (WEB-14); it sends an unacknowledged notice first. */
const workHref = (assignmentId: string) => `/rad/${encodeURIComponent(assignmentId)}`;

/** The same read as /zadaci, asked only once RoleShell found a session with a role. */
async function Courses() {
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const read = await readMyAssignments(serverApi(cookie));
  const enroll = (
    <p>
      <a className="btn" href="/upis">{t.student.home.enrollLink}</a>
    </p>
  );
  return (
    <div className="page">
      <StudentHome read={read} enroll={enroll} signIn={signInPage} view="courses" assignmentHref={workHref} />
    </div>
  );
}

/**
 * S: E-3 "Moji kolegiji" (WEB-10): the student's own courses with their
 * assignments, from student.assignments.get through src/client with the
 * request's session cookie. It adds and filters nothing; no database access.
 */
export default function MyCoursesPage() {
  return (
    <RoleShell here={HERE} current={HERE} crumbs={[t.student.home.courses]}>
      <Courses />
    </RoleShell>
  );
}
