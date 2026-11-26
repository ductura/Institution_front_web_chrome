"use client";

import { useCallback, useMemo } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { CodeTestsForm } from "./CodeTestsForm";
import { codeTestsText as t } from "./messages.hr";
import { codeTestsPortFor } from "./port";

/**
 * Teacher: "Testovi uz zadatak" of one assignment (WEB-V21-KOD-TESTOVI-OBRAZAC, over teacher.assignment-code-tests.*).
 * A standalone screen reached by its path; the link to it from the task's card is a separate task (the assignment
 * form and card belong to another lane).
 */
export default function CodeTestsPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const here = appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/testovi`);
  const port = useMemo(() => codeTestsPortFor(() => createApi()), []);
  const signedOut = useCallback(() => goToSignIn(here), [here]);
  return (
    <div className="page">
      <p><a href={appHref(base, "/nastavnik")}><span aria-hidden="true">← </span>{t.back}</a></p>
      <header><h1>{t.title}</h1><p>{t.lead}</p></header>
      <CodeTestsForm assignmentId={assignmentId} port={port} onSignedOut={signedOut} />
    </div>
  );
}
