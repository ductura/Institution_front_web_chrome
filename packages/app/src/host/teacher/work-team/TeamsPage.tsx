"use client";

import { useCallback, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { teacherTeamText as t } from "./messages.hr";
import { TeamSettingPanel } from "./TeamSettingPanel";
import { TeamsPanel } from "./TeamsPanel";
import type { Setting } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

/**
 * Teacher: "Timovi na zadatku" (WEB-V19-GRUPA, over institution.assignment-team-setting.* and teacher.work-team*).
 * The setting panel and the teams panel read on their own, so a failed read of one says so without hiding the
 * other; the teams are read again whenever the setting is. Entered from the task's card in N-01 by a link.
 * `call` is for tests.
 */
export default function TeamsPage({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/timovi`);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [version, setVersion] = useState(0);
  const signedOut = useCallback(() => goToSignIn(here), [here]);
  const changed = useCallback((next: Setting | null) => { setSetting(next); setVersion((n) => n + 1); }, []);
  return (
    <div className="page">
      <p><a href={appHref(base, "/nastavnik")}><span aria-hidden="true">← </span>{t.back}</a></p>
      <header><h1>{t.title}</h1><p>{t.lead}</p></header>
      <TeamSettingPanel assignmentId={assignmentId} call={call} onSignedOut={signedOut} onChanged={changed} />
      <TeamsPanel assignmentId={assignmentId} call={call} setting={setting} version={version} onSignedOut={signedOut} />
    </div>
  );
}
