import Link from "next/link";

import RoleShell from "@/components/shell/RoleShell";
import AccessLogPanel from "@/components/student/AccessLogPanel";
import { assignmentIdOf, cursorOf } from "@/components/student/access-log-read";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.accessLog.context} · ${t.app.name}` };

/**
 * S-42 (DAN-294; WEB-13 over /api/v1): the student's own access log (PRODUCT
 * §5 rule 17). The shell checks the session (me); the log itself is read in
 * the browser through the contract (AccessLogPanel): evidence.open.post
 * without `start` finds the student's own work, never makes one, and
 * student.access-log.get answers only for its owner. Another student's work,
 * an unknown one and a failed read never show a row.
 */
export default async function StudentAccessLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assignmentId: raw } = await params;
  const assignmentId = assignmentIdOf(raw);
  const here = `/rad/${encodeURIComponent(raw)}/dnevnik-pristupa`;
  return (
    <RoleShell here={here} crumbs={[t.accessLog.context]}>
      <div className="page access-log">
        <h1>{t.accessLog.title}</h1>
        {assignmentId === null ? (
          <p role="status">{t.accessLog.invalid}</p>
        ) : (
          <>
            <p><Link href={`/rad/${assignmentId}`}>{t.accessLog.backToWork}</Link></p>
            <AccessLogPanel assignmentId={assignmentId} cursor={cursorOf(await searchParams)} here={here} />
          </>
        )}
      </div>
    </RoleShell>
  );
}
