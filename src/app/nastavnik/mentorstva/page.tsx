import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { serverApi } from "@/client/server";
import MentoredWorks from "@/components/teacher/MentoredWorks";
import MentorshipRequests, { type RequestsRead } from "@/components/teacher/MentorshipRequests";
import { readMentoredWorks } from "@/components/teacher/mentored-works-read";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "../page.module.css";

const t = messagesHr.mentoredWorks;
const HREF = "/nastavnik/mentorstva";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

/**
 * TODO(ugovor): teacher.mentorship-requests.get comes with @ductura/contracts
 * 3.2.0 (SRV-27, SRV-32) and its handler with SRV-31; then the page reads it
 * with readMentorshipRequests (src/client/mentorship-requests.ts). Until then
 * no call is made and the card says the requests are unavailable, never "none".
 */
const REQUESTS: RequestsRead = { kind: "unavailable" };

/**
 * `/nastavnik/mentorstva` (WEB-32, N-16): the works the teacher mentors
 * through teacher.mentorships.get under the request's cookie, and the card of
 * mentorship requests. The server decides whose works; the shell (layout) has
 * already read the session and the role. A failed read is said as such, never
 * as "no works".
 */
export default async function MentoredWorksPage() {
  const read = await readMentoredWorks(serverApi((await cookies()).toString()));
  if (read.kind === "signedOut") redirect(signInHref(HREF));
  const works = read.kind === "ready" ? <MentoredWorks works={read.works} /> : (
    <>
      <p role="alert" className={styles.alert}>{t.unavailable}</p>
      <p><a className={styles.retry} href={HREF}>{t.retry}</a></p>
    </>
  );
  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <h1>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
        </div>
      </div>
      <MentorshipRequests read={REQUESTS} here={HREF} />
      {works}
    </div>
  );
}
