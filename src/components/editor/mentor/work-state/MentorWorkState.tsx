"use client";

import { Button, Details } from "@ductura/ui";
import { useEffect, useState } from "react";
import { readConsultationVersions, type VersionsPage } from "../../../../client/consultation-records";
import { MentoredStudents } from "../../../teacher/mentored-students/MentoredStudents";
import { MentorTime, WorkTimeline } from "../timeline/WorkTimeline";
import { readMilestones, workStatus, type Milestone } from "../timeline/work-timeline";
import { mentorWorkHr as t } from "./messages.hr";
import styles from "./MentorWorkState.module.css";

export function MentorWorkState({ documentId, role, submitted, receiptHref }: {
  documentId?: string;
  role: "student" | "teacher";
  submitted?: boolean;
  receiptHref?: string;
}) {
  const [versions, setVersions] = useState<VersionsPage | null>();
  const [milestones, setMilestones] = useState<Milestone[] | null>();
  const [showTimeline, setShowTimeline] = useState(false);
  useEffect(() => {
    if (!documentId) return;
    let live = true;
    void readConsultationVersions(documentId, null).then((read) => { if (live) setVersions(read); });
    void readMilestones(documentId).then((read) => { if (live) setMilestones(read); });
    return () => { live = false; };
  }, [documentId, submitted]);

  const status = workStatus(submitted, versions);
  const submission = versions?.versions.find((version) => version.kind === "submission");
  const next = status === "inProgress" ? milestones?.find((milestone) => milestone.state !== "approved") : undefined;
  return <div className={styles.panel}>
    <section className={styles.state} aria-label={t.state}>
      <h3>{t.state}</h3>
      <p role="status"><strong>{t[status]}</strong></p>
      {next && <p>{t.next} · {next.title}{next.dueAt && <> · {t.due} <MentorTime at={next.dueAt} /></>}</p>}
    </section>
    <div className={styles.actions}>
      {documentId && <Button tone="quiet" onClick={() => setShowTimeline(true)}>{t.timeline}</Button>}
      {role === "teacher" && versions && <MentoredStudents role={role} />}
    </div>
    <Details summary={t.after} open={status === "submitted"}>
      {status === "submitted" ? <p>{t.submitted}{submission && <> · <MentorTime at={submission.savedMinute} /></>}</p>
        : <p>{status === "inProgress" ? t.afterWaiting : t[status]}</p>}
      {status === "submitted" && receiptHref && <p><a href={receiptHref}>{t.receipt}</a></p>}
    </Details>
    {documentId && showTimeline && <WorkTimeline documentId={documentId} milestones={milestones}
      firstPage={versions} onClose={() => setShowTimeline(false)} />}
  </div>;
}
