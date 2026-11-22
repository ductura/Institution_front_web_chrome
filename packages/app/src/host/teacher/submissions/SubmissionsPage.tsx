"use client";

// PIL-D2-PREDAJE: the page that mounts TeacherSubmissions (WEB-1502) with the real port. The page
// title and frame are the host's (.page, .pagehead), as the other teacher pages of one assignment.
import { useMemo } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import type { SubmissionsCall } from "../../../../../../src/client/teacher-submissions.ts";
import { useHost } from "../../context";
import TeacherSubmissions from "./TeacherSubmissions";
import { submissionsMessages as text } from "./messages.hr";
import { clientSubmissionsPort, signInReturn } from "./port";

export function TeacherSubmissionsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  // The cast as in the other host pages (Merlin, N-01): createApi is generic over every operation id,
  // SubmissionsCall names only the two this screen reads; the client checks each answer against the contract.
  const port = useMemo(() => clientSubmissionsPort(
    createApi() as unknown as SubmissionsCall,
    () => goToSignIn(signInReturn(base, assignmentId)),
  ), [base, assignmentId]);
  return (
    <div className="page">
      <div className="pagehead">
        <h1>{text.pageTitle}</h1>
        <p className="lede">{text.pageLead}</p>
      </div>
      <TeacherSubmissions port={port} assignmentId={assignmentId} />
    </div>
  );
}
