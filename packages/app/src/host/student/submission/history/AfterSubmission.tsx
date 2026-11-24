"use client";

// NF-3 PR-13, PR-15 on step 5: the withdrawal with its reason and what comes next, and "Moje predaje".
// The history is read once here and again after a withdrawal, so both say the same thing.
import { useEffect, useState } from "react";

import { createApi, goToSignIn } from "../../../../../../../src/client/api";
import WithdrawSubmission from "../withdraw/WithdrawSubmission";
import type { WithdrawCall } from "../withdraw/contract";
import { readStudentHistory, type HistoryCall, type HistoryRead } from "./contract";
import { lastIsWithdrawal } from "./model";
import MySubmissions from "./MySubmissions";

const defaultHistory = () => createApi() as unknown as HistoryCall;

export type AfterSubmissionProps = {
  readonly assignmentId: string;
  /** The later of the deadline and its extension, from the checked assignment; the history's when unknown. */
  readonly deadline: string | null;
  readonly workHref: string;
  readonly receiptHref: string;
  /** Where sign-in returns. */
  readonly here: string;
  readonly historyCall?: () => HistoryCall;
  readonly withdrawCall?: () => WithdrawCall;
};

export default function AfterSubmission({ assignmentId, deadline, workHref, receiptHref, here, historyCall = defaultHistory, withdrawCall }: AfterSubmissionProps) {
  const [read, setRead] = useState<HistoryRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void readStudentHistory(historyCall(), assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "session-expired") goToSignIn(here);
      setRead(next);
    });
    return () => { live = false; };
    // `historyCall` and `here` are stable per mount; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, attempt]);
  const history = read?.kind === "ready" ? read.history : null;
  const context = {
    allowed: history === null ? null : history.withdrawalAllowed,
    deadline: deadline ?? history?.dueAt ?? null,
    withdrawn: history !== null && lastIsWithdrawal(history.events),
  };
  return (
    <>
      <WithdrawSubmission assignmentId={assignmentId} call={withdrawCall} context={context} workHref={workHref}
        onWithdrawn={() => setAttempt((n) => n + 1)} />
      <MySubmissions read={read} receiptHref={receiptHref} onRetry={() => { setRead(null); setAttempt((n) => n + 1); }} />
    </>
  );
}
