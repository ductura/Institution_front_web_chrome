import { cookies } from "next/headers";

import { serverApi } from "@/client/server";
import TeacherCourses from "@/components/teacher/TeacherCourses";
import { readTeacherCourses } from "@/components/teacher/teacher-courses-read";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "./page.module.css";

const t = messagesHr.teacherCourses;

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

// WEB-17 (Ductus#2028 c.7008147932): the teacher's home through the institution server. The
// shell (layout) has read the session; the courses come from
// teacher.courses.get under the request's cookie, so the server decides
// whose. The works of each assignment and the course actions (codes, a new
// assignment) join with N-01 and N-02/03 (WEB-18, WEB-19).
export default async function TeacherHomePage() {
  const server = serverApi((await cookies()).toString());
  const read = await readTeacherCourses(server);
  let body;
  if (read.kind === "ready") {
    body = <TeacherCourses courses={read.courses} />;
  } else {
    // A session that ended after the shell's read, or a role the server no
    // longer confirms, reads like an unavailable list: never an empty one.
    body = (
      <>
        <p role="alert" className={styles.alert}>{t.unavailable}</p>
        <p><a className={styles.retry} href="/nastavnik">{t.retry}</a></p>
      </>
    );
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
