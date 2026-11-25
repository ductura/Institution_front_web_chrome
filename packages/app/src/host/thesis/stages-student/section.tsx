"use client";

// WEB-V16-ETAPE-STUDENT: the student's "Etape" section of the "Završni rad" panel. Reads the milestones of the
// work and sends one; the mentor's side (approve, return, deadline) stays in WorkPlan and is not touched.
import { useRef, useState } from "react";

import { Button } from "@ductura/ui";

import { maySubmit, readStudentMilestones, submitMilestone, type StudentMilestone } from "../../../../../../src/client/milestone-submit";
import type { SectionViewProps, ThesisSectionDef } from "../model";
import { stagesStudentHr as t } from "./messages.hr";
import { showDate, stagesRead, type StageList } from "./model";

type Notice = "saved" | "changed" | "unknown" | "sessionExpired";

function Stage({ item, busy, onSubmit }: { item: StudentMilestone; busy: boolean; onSubmit: (id: string) => void }) {
  const due = showDate(item.dueAt);
  const revisionDue = showDate(item.revisionDueAt);
  const submitted = showDate(item.submittedAt);
  const approved = showDate(item.approvedAt);
  return (
    <li data-testid={`stage-${item.id}`}>
      <strong>{item.title}</strong> <span>{t.states[item.state]}</span>
      {item.description !== "" ? <p>{item.description}</p> : null}
      <p>{t.due}: {due ?? t.noDue}</p>
      {item.state === "submitted" && submitted ? <p>{t.submittedAt}: {submitted}</p> : null}
      {item.state === "approved" && approved ? <p>{t.approvedAt}: {approved}</p> : null}
      {item.state === "revision_requested" ? (
        <>
          {item.revisionComment ? <p>{t.revisionComment}: {item.revisionComment}</p> : null}
          {revisionDue ? <p>{t.revisionDue}: {revisionDue}</p> : null}
        </>
      ) : null}
      {maySubmit(item) ? <Button busy={busy} onClick={() => onSubmit(item.id)}>{t.submit}</Button> : null}
    </li>
  );
}

function StagesView({ documentId, value, reload }: SectionViewProps<StageList>) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // A ref, not the state: two clicks in the same tick must send one request.
  const sending = useRef(false);

  const submit = (milestoneId: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice(null);
    void submitMilestone(documentId, milestoneId).then((result) => {
      sending.current = false;
      setBusy(false);
      if (result.kind === "saved") { setNotice("saved"); reload(); return; }
      if (result.kind === "promijenjeno") { setNotice("changed"); reload(); return; }
      setNotice(result.kind === "session-expired" ? "sessionExpired" : "unknown");
    });
  };

  return (
    <div>
      {notice ? <p role={notice === "saved" ? "status" : "alert"}>{t[notice]}</p> : null}
      <ul>{value.map((item) => <Stage key={item.id} item={item} busy={busy} onSubmit={submit} />)}</ul>
    </div>
  );
}

export const section: ThesisSectionDef<StageList> = {
  id: "stages-student",
  order: 30,
  title: t.title,
  read: async (documentId, role) => {
    if (role !== "student") return { kind: "notFound" };
    return stagesRead(role, await readStudentMilestones(documentId));
  },
  View: StagesView,
};
