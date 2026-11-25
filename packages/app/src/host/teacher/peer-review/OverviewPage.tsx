"use client";

import { useCallback, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { teacherPeerReviewText as t } from "./messages.hr";
import { OverviewPanel } from "./OverviewPanel";
import { RoundPanel } from "./RoundPanel";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

/**
 * Teacher: "Recenzija među studentima" of one assignment (WEB-V19-RECENZIJA-NASTAVNIK, over peer-review.*).
 * The round panel and the overview read on their own, so a failed read of one says so without hiding the other;
 * the overview is read again whenever the round is. Entered from the task's card in N-01 by a link. `call` is for tests.
 */
export default function OverviewPage({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/recenzija`);
  const [version, setVersion] = useState(0);
  const signedOut = useCallback(() => goToSignIn(here), [here]);
  const changed = useCallback(() => setVersion((n) => n + 1), []);
  return (
    <div className="page">
      <p><a href={appHref(base, "/nastavnik")}><span aria-hidden="true">← </span>{t.back}</a></p>
      <header><h1>{t.title}</h1><p>{t.lead}</p></header>
      <RoundPanel assignmentId={assignmentId} call={call} onSignedOut={signedOut} onChanged={changed} />
      <OverviewPanel assignmentId={assignmentId} call={call} version={version} onSignedOut={signedOut} />
    </div>
  );
}
