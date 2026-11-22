"use client";

// PIL-D7-OBNOVA: "Vrati raniju verziju" inside "Povijest dokumenta". It lists the versions through the
// history's own read and restores through the real port (client-port.ts) on the open editor.
import { useEffect, useMemo, useState } from "react";

import type { TimeMachinePort, Version } from "../../time-machine/model";
import { clientRestorePort } from "./client-port";
import type { RestorePort } from "./model";
import RestoreVersion from "./RestoreVersion";
import { useRestoreEditor } from "./restore-editor";

export default function RestoreHost({ documentId, history, port, onRestored }: {
  documentId: string;
  history: Pick<TimeMachinePort, "versions">;
  /** Only tests pass one; the page uses the editor's save path. */
  port?: RestorePort;
  onRestored?: (fromRevision: number, newRevision: number) => void;
}) {
  const editor = useRestoreEditor();
  const real = useMemo(() => port ?? clientRestorePort(editor), [port, editor]);
  const [versions, setVersions] = useState<readonly Version[] | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let active = true;
    void history.versions(documentId)
      .then((read) => { if (active) setVersions(read.kind === "ready" ? read.versions : null); })
      .catch(() => { if (active) setVersions(null); });
    return () => { active = false; };
  }, [documentId, history, round]);

  // Without a list there is nothing to restore; the history above already says why.
  if (versions === null) return null;
  return (
    <RestoreVersion
      documentId={documentId}
      versions={versions}
      port={real}
      onRestored={(from, to) => { setRound((n) => n + 1); onRestored?.(from, to); }}
      onStale={() => setRound((n) => n + 1)}
    />
  );
}
