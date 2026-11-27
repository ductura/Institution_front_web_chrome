import Link from "next/link";

import RoleShell from "@/components/shell/RoleShell";
import { AccessLogUnavailable } from "@/components/student/AccessLogView";
import { assignmentIdOf } from "@/components/student/access-log-read";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.accessLog.context}, ${t.app.name}` };

/**
 * S-42 (DAN-294; WEB-13 over /api/v1): the student's own access log (PRODUCT
 * §5 rule 17). The shell checks the session (me). The contract has no
 * read-only route from the assignment to the student's own work, which
 * student.access-log.get needs, and evidence.open.post is never used for it
 * (it opens the document; orchestrator, #87 c.7010793472). Until the server
 * adds that route the log reads as unavailable, with no call at all.
 */
export default async function StudentAccessLogPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
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
            {/* Design alignment 27. 11. 2026. (S-42): the load alert with "Pokušaj ponovno", not a status line. */}
            <AccessLogUnavailable retryHref={here} />
          </>
        )}
      </div>
    </RoleShell>
  );
}
