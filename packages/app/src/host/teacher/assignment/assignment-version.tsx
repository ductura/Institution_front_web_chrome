"use client";

import { readAssignmentVersion } from "@/client/teacher-assignment";
import AssignmentVersionForm from "@/components/teacher/AssignmentVersionForm";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { AssignmentPage, useAssignmentRead } from "./page-state";

const t = messagesHr.teacher.newVersion;

export default function AssignmentVersionPage({ assignmentId }: { assignmentId: string }) {
  const path = `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/uredi`;
  const [read, retry] = useAssignmentRead(path, () => readAssignmentVersion(assignmentId));

  return (
    <AssignmentPage title={t.title} read={read} retry={retry} unavailable={t.unavailable} missing={t.missing}>
      {(current, href) => <AssignmentVersionForm current={current} backHref={href("/nastavnik")} onReload={retry} />}
    </AssignmentPage>
  );
}
