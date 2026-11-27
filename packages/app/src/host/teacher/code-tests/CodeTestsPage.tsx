"use client";

import { useCallback, useMemo } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { CodeTestsForm } from "./CodeTestsForm";
import { codeTestsText as t } from "./messages.hr";
import { codeTestsPortFor } from "./port";
import { MAX_TESTS } from "./model";
import { taskPath } from "../work/review/model";

/**
 * Teacher: "Testovi uz zadatak" of one assignment (WEB-V21-KOD-TESTOVI-OBRAZAC, over teacher.assignment-code-tests.*).
 * Reached from the task's card (AssignmentFacts); "Natrag na zadatak" returns to the assignment's submissions.
 */
export default function CodeTestsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const here = appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/testovi`);
  const port = useMemo(() => codeTestsPortFor(() => createApi()), []);
  const signedOut = useCallback(() => goToSignIn(here), [here]);
  return (
    <div className="page">
      <p><a href={appHref(base, taskPath(assignmentId))}><span aria-hidden="true">← </span>{t.back}</a></p>
      <header><h1>{t.title}</h1><p>{t.lead.replace("{max}", String(MAX_TESTS))}</p></header>
      <CodeTestsForm assignmentId={assignmentId} port={port} onSignedOut={signedOut} />
    </div>
  );
}
