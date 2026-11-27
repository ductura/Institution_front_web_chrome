import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { serverApi } from "@/client/server";
import LoadAlert, { DeniedState } from "@/components/shell/LoadAlert";
import RoleShell, { signInPage } from "@/components/shell/RoleShell";
import { courseHref, noticeHref, readCourse, type CourseRead } from "@/components/student/upis/course-read";
import styles from "@/components/student/upis/Enroll.module.css";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.student.enroll.title}, ${t.app.name}` };

const c = t.student.enroll.course;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PRODUCT §5 rule 6: the step between the enrollment and the notice. The
// student goes straight to the notice of the course's open assignment; this
// page only shows something when there is no notice to go to.
export default async function EnrolledCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const here = courseHref(courseId);
  const read: CourseRead = UUID.test(courseId)
    ? await readCourse(serverApi((await cookies()).toString()), courseId)
    : { kind: "notFound" };
  // redirect() throws, so it stays outside any try block.
  if (read.kind === "assignment") redirect(noticeHref(read.assignmentId));
  if (read.kind === "signedOut") redirect(signInPage(here));
  // Design alignment 27. 11. 2026. (KU4): 403 is not a read error; the heading and the way back only.
  if (read.kind === "denied") {
    return (
      <RoleShell here={here} current="/upis" crumbs={[t.student.enroll.title]}>
        <div className="page"><DeniedState /></div>
      </RoleShell>
    );
  }
  return (
    <RoleShell here={here} current="/upis" crumbs={[t.student.enroll.title]}>
      <div className={`page ${styles.screen}`}>
        <section className={styles.card}>
          <h1>{t.student.enroll.title}</h1>
          {/* Design alignment 27. 11. 2026. (KU3): a read that failed is the role=alert frame, the links stay in the row under it. */}
          {read.kind === "unavailable"
            ? <LoadAlert>{c.unavailable}</LoadAlert>
            : <p className={styles.status} role="status">{c[read.kind]}</p>}
          <div className={styles.links}>
            {read.kind === "unavailable" ? <Link href={here} prefetch={false}>{c.retry}</Link> : null}
            <Link href="/upis">{c.another}</Link>
          </div>
        </section>
        <p><Link href="/">{t.teacher.backHome}</Link></p>
      </div>
    </RoleShell>
  );
}
