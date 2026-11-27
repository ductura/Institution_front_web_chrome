import Link from "next/link";

import RoleShell, { signInPage } from "@/components/shell/RoleShell";
import EnrollForm from "@/components/student/upis/EnrollForm";
import styles from "@/components/student/upis/Enroll.module.css";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.student.enroll.title}, ${t.app.name}` };

const HERE = "/upis";

// E-5 (WEB-11, F-7): enrollment by the teacher's code over /api/v1. The shell
// reads the session (me); the enrollment route decides everything else.
export default function EnrollPage() {
  return (
    <RoleShell here={HERE} current={HERE} crumbs={[t.student.enroll.title]}>
      <div className={`page ${styles.screen}`}>
        <section className={styles.card}>
          <h1>{t.student.enroll.heading}</h1>
          <EnrollForm signInHref={signInPage(HERE)} />
        </section>
        <p><Link href="/">{t.teacher.backHome}</Link></p>
      </div>
    </RoleShell>
  );
}
