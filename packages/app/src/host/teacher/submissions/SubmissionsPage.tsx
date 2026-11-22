"use client";

// PIL-D2-PREDAJE: the page that mounts TeacherSubmissions (WEB-1502) with the real port. The page
// title and frame are the host's (.page, .pagehead), as the other teacher pages of one assignment.
import { useMemo } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import type { SubmissionsCall } from "../../../../../../src/client/teacher-submissions.ts";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import TeacherSubmissions from "./TeacherSubmissions";
import { submissionsMessages as text } from "./messages.hr";
import { clientSubmissionsPort, submissionsHref } from "./port";

export function TeacherSubmissionsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const port = useMemo(() => clientSubmissionsPort(
    createApi() as unknown as SubmissionsCall,
    () => goToSignIn(appHref(base, submissionsHref(assignmentId))),
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
