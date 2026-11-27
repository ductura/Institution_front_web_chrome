import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { serverApi } from "@/client/server";
import LoadAlert, { DeniedState } from "@/components/shell/LoadAlert";
import TeacherCourses from "@/components/teacher/TeacherCourses";
import { readTeacherCourses } from "@/components/teacher/teacher-courses-read";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "./page.module.css";

const t = messagesHr.teacherCourses;
const HREF = "/nastavnik";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title}, ${messagesHr.app.name}` };

// WEB-17 (Ductus#2028 c.7008147932): the teacher's home through the institution server. The
// shell (layout) has read the session; the courses come from
// teacher.courses.get under the request's cookie, so the server decides
// whose. The works of each assignment and the course actions (codes, a new
// assignment) join with N-01 and N-02/03 (WEB-18, WEB-19).
export default async function TeacherHomePage() {
  const server = serverApi((await cookies()).toString());
  const read = await readTeacherCourses(server);
  // A session that ended after the shell's read goes to the AAI@EduHr sign-in
  // and a role the server no longer confirms is told so; only a failed read is
  // said as an unavailable list, never as an empty one.
  if (read.kind === "signedOut") redirect(signInHref(HREF));
  if (read.kind === "notTeacher") return <div className="page"><DeniedState /></div>;
  const body = read.kind === "ready"
    ? <TeacherCourses courses={read.courses} />
    : <LoadAlert retry={{ label: t.retry, href: HREF }}>{t.unavailable}</LoadAlert>;
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
