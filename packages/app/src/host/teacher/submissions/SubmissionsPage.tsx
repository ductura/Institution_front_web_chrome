"use client";

// PIL-D2-PREDAJE: the page that mounts TeacherSubmissions (WEB-1502) with the real port. The page
// title and frame are the host's (.page, .pagehead), as the other teacher pages of one assignment.
// PIL-D1-BEZ-OCJENE: above the table the grade route decides what is offered. A regular assignment gets
// the bulk download (WEB-1902); a practice one gets the calm note "Probni zadatak se ne ocjenjuje" and no
// grade or export action.
import { useCallback, useMemo } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import type { SubmissionsCall } from "../../../../../../src/client/teacher-submissions.ts";
import { useHost } from "../../context";
import BulkDownload from "./bulk/BulkDownload";
import type { BulkCall } from "./bulk/contract";
import { GradeGate, useGradeRead } from "./grade/GradeGate";
import type { GradeCall } from "./grade/contract";
import TeacherSubmissions from "./TeacherSubmissions";
import { submissionsMessages as text } from "./messages.hr";
import { clientSubmissionsPort, signInReturn } from "./port";
import { clientHistoryCall, type HistoryTransport } from "./history/port";

export function TeacherSubmissionsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const signIn = useCallback(() => goToSignIn(signInReturn(base, assignmentId)), [base, assignmentId]);
  // The casts as in the other host pages (Merlin, N-01): createApi is generic over every operation id,
  // each call type names only the operations its module reads; the client checks each answer against the contract.
  const call = useMemo(() => createApi(), []);
  const port = useMemo(() => clientSubmissionsPort(call as unknown as SubmissionsCall, signIn), [call, signIn]);
  const history = useMemo(() => clientHistoryCall(call as unknown as HistoryTransport), [call]);
  const grade = useGradeRead(call as unknown as GradeCall, assignmentId, signIn);
  return (
    <div className="page">
      <div className="pagehead">
        <h1>{text.pageTitle}</h1>
        <p className="lede">{text.pageLead}</p>
      </div>
      <GradeGate read={grade.read} onRetry={grade.retry}>
        <BulkDownload call={call as unknown as BulkCall} assignmentId={assignmentId} onSignedOut={signIn} />
      </GradeGate>
      <TeacherSubmissions port={port} assignmentId={assignmentId} history={history} onSignedOut={signIn} />
    </div>
  );
}
