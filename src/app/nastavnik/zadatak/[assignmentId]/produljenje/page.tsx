import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { readDeadlineExtensions, readExtensionStudents } from "@/client/deadline-extensions";
import { serverApi } from "@/client/server";
import DeadlineExtensions, { type ExtensionsRead } from "@/components/teacher/deadline-extensions/DeadlineExtensions";
import { extensionsHref } from "@/components/teacher/links";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "../../../page.module.css";

const t = messagesHr.deadlineExtensions;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

/**
 * `/nastavnik/zadatak/[assignmentId]/produljenje` (WEB-1113, N-13, C-15): the
 * extensions of one assignment through teacher.deadline-extensions.get and
 * the students it may name through teacher.assignment-overview.get, both
 * under the request's cookie. The server decides who teaches the assignment
 * (C-23): an assignment the teacher does not teach reads as not found. A
 * failed read is said as such, never as "none".
 */
export default async function DeadlineExtensionsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: sent } = await params;
  if (!uuid.test(sent)) notFound();
  const assignmentId = sent.toLowerCase();
  const client = serverApi((await cookies()).toString());
  const [list, students] = await Promise.all([readDeadlineExtensions(client, assignmentId), readExtensionStudents(client, assignmentId)]);
  if (list.kind === "session-expired") redirect(signInHref(extensionsHref(assignmentId)));
  if (list.kind === "greska" && list.code === "not_found") notFound();
  const read: ExtensionsRead = list.kind === "ready" ? { kind: "ready", extensions: list.extensions } : { kind: "unavailable" };
  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <h1>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
        </div>
      </div>
      <DeadlineExtensions assignmentId={assignmentId} read={read} students={students} />
    </div>
  );
}
