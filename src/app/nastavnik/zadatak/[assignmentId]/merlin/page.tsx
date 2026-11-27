import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { readMerlinRoster } from "@/client/merlin-export";
import { serverApi } from "@/client/server";
import MerlinExport, { type RosterRead } from "@/components/teacher/merlin-export/MerlinExport";
import { merlinHref } from "@/components/teacher/merlin-export/links";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "../../../page.module.css";

const t = messagesHr.merlinExport;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.title}, ${messagesHr.app.name}` };

/**
 * `/nastavnik/zadatak/[assignmentId]/merlin` (WEB-1114, N-18, C-16): the
 * Merlin roster of one assignment through teacher.merlin-roster.get under the
 * request's cookie, in the server's order (the CSV's). The server decides who
 * teaches the assignment: one the teacher does not teach reads as not found.
 * A failed read is said as such, never as "no students".
 */
export default async function MerlinExportPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: sent } = await params;
  if (!uuid.test(sent)) notFound();
  const assignmentId = sent.toLowerCase();
  const read = await readMerlinRoster(serverApi((await cookies()).toString()), assignmentId);
  if (read.kind === "session-expired") redirect(signInHref(merlinHref(assignmentId)));
  if (read.kind === "greska" && read.code === "not_found") notFound();
  const roster: RosterRead = read.kind === "ready"
    ? { kind: "ready", rows: read.rows, extensionReasons: read.extensionReasons }
    : { kind: "unavailable" };
  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <h1>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
        </div>
      </div>
      <MerlinExport assignmentId={assignmentId} roster={roster} />
    </div>
  );
}
