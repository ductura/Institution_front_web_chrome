"use client";

import { useSearchParams } from "next/navigation";

import { readAssignmentVersion } from "@/client/teacher-assignment";
import AssignmentVersionForm from "@/components/teacher/AssignmentVersionForm";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { AssignmentCopy } from "../assignment-copy/AssignmentCopy";
import { NoticePreview } from "../publish/NoticePreview";
import { PracticeReadBack } from "../assignment-form/PracticeField";
import { AssignmentPage, useAssignmentRead } from "./page-state";
import SubmissionRulesLive from "./SubmissionRulesLive";

const t = messagesHr.teacher.newVersion;

export default function AssignmentVersionPage({ assignmentId }: { assignmentId: string }) {
  const path = `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/uredi`;
  const [read, retry] = useAssignmentRead(path, () => readAssignmentVersion(assignmentId));
  // NZ-1: "Kopiraj zadatak" on the course card opens the copy dialog here.
  const copy = useSearchParams().get("kopiraj") === "1";

  return (
    <AssignmentPage title={t.title} read={read} retry={retry} unavailable={t.unavailable} missing={t.missing}>
      {(current, href) => <>
        <AssignmentCopy current={current} href={href} startOpen={copy} />
        <NoticePreview fields={{ versionNo: current.versionNo, dueAt: current.dueAt, aiPolicy: current.aiPolicy, aiPurposes: current.aiPurposes, importAllowed: current.importAllowed, wordMin: current.wordMin ?? null, wordMax: current.wordMax ?? null }} />
        <PracticeReadBack current={current} />
        <AssignmentVersionForm current={current} backHref={href("/nastavnik")} onReload={retry} />
        <SubmissionRulesLive assignmentId={assignmentId} />
      </>}
    </AssignmentPage>
  );
}
