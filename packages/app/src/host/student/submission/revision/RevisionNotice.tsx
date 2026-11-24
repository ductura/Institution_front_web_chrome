"use client";

// NF-3 PR-16 (E-7b, G-24): on steps 2 to 4, the teacher's request for revision as one whole: the
// deadline beside the title, the comment, and "Pošalji doradu", which stays unavailable while the
// contract has no such operation (`send: null`, PO-40). A work without a request, or a request that
// cannot be read, shows nothing here: the steps themselves do not change.
import { Button, StepKv, StepPanel } from "@ductura/ui";
import { useEffect, useId, useState } from "react";

import { createApi } from "../../../../../../../src/client/api";
import { atOf } from "../steps/time";
import { readRevisionRequest, type RevisionCall, type RevisionRead } from "./contract";
import { revisionText as t } from "./messages.hr";

const defaultCall = () => createApi() as unknown as RevisionCall;

export type RevisionNoticeProps = {
  readonly assignmentId: string;
  /** On the declaration step the block also asks to look at the declaration again (PR-14, option c). */
  readonly onDeclaration?: boolean;
  readonly call?: () => RevisionCall;
};

export default function RevisionNotice({ assignmentId, onDeclaration = false, call = defaultCall }: RevisionNoticeProps) {
  const [read, setRead] = useState<RevisionRead | null>(null);
  const why = useId();
  useEffect(() => {
    let live = true;
    void readRevisionRequest(call(), assignmentId).then((next) => { if (live) setRead(next); });
    return () => { live = false; };
    // `call` is stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);
  if (read === null || read.kind !== "ready" || read.request === null) return null;
  const { comment, dueAt } = read.request;
  const due = dueAt === null ? null : atOf(dueAt);
  return (
    <StepPanel id="sb-revision-h" level={2} title={t.title} tag={due === null ? t.tag : t.dueTag.replace("{due}", due)}>
      <p className="note">{t.lead}</p>
      <StepKv label={t.comment}>{comment}</StepKv>
      <StepKv label={t.due}>{due ?? t.dueMissing}</StepKv>
      {onDeclaration && <p className="note">{t.declaration}</p>}
      <p>
        <Button tone="secondary" aria-disabled aria-describedby={why}>{t.send}</Button>
      </p>
      <p className="meta" id={why}>{t.sendUnavailable}</p>
    </StepPanel>
  );
}
