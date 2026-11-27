import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { serverApi } from "@/client/server";
import LoadAlert from "@/components/shell/LoadAlert";
import CourseCodes from "@/components/teacher/kolegiji/CourseCodes";
import { readTeacherCourses } from "@/components/teacher/teacher-courses-read";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "../page.module.css";

const t = messagesHr.teacherCourseCodes;
const HREF = "/nastavnik/kolegiji";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title}, ${messagesHr.app.name}` };

/**
 * `/nastavnik/kolegiji` (WEB-18, N-01): the teacher's courses through
 * teacher.courses.get under the request's cookie, each with the dk-h dialog
 * for its enrolment code. A teacher without a course is told that the
 * faculty administrator creates courses (A-7); there is no course form here.
 * The shell (layout) has already read the session and the role.
 */
export default async function TeacherCourseCodesPage() {
  const server = serverApi((await cookies()).toString());
  const read = await readTeacherCourses(server);
  if (read.kind === "signedOut") redirect(signInHref(HREF));
  let body;
  if (read.kind === "ready" && read.courses.length > 0) {
    body = <CourseCodes courses={read.courses} here={HREF} />;
  } else if (read.kind === "ready") {
    body = (
      <section aria-labelledby="kolegiji-prazno">
        <h2 id="kolegiji-prazno">{t.emptyTitle}</h2>
        <p>{t.emptyBody}</p>
        <p>{t.emptyNext}</p>
      </section>
    );
  } else {
    // A role the server no longer confirms reads like an unavailable list: never an empty one.
    body = <LoadAlert retry={{ label: t.retry, href: HREF }}>{t.unavailable}</LoadAlert>;
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
