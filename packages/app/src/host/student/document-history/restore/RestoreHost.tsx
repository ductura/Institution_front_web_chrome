"use client";

// PIL-D7-OBNOVA: "Vrati raniju verziju" inside "Povijest dokumenta". It lists the versions through the
// history's own read and restores through the real port (client-port.ts) on the open editor.
import { useEffect, useMemo, useRef, useState } from "react";

import type { TimeMachinePort, Version } from "../../time-machine/model";
import { clientRestorePort } from "./client-port";
import { restoreMessages as text } from "./messages.hr";
import {
  awaitRestoreReceipt, confirmRestored, recordRestored, type RestoredLabel, type RestorePort,
} from "./model";
import RestoreVersion from "./RestoreVersion";
import { useRestoreEditor } from "./restore-editor";

export default function RestoreHost({ documentId, history, port, onRestored }: {
  documentId: string;
  history: Pick<TimeMachinePort, "versions">;
  /** Only tests pass one; the page uses the editor's save path. */
  port?: RestorePort;
  onRestored?: () => void;
}) {
  const editor = useRestoreEditor();
  const real = useMemo(() => port ?? clientRestorePort(editor), [port, editor]);
  const [versions, setVersions] = useState<readonly Version[] | null>(null);
  const [round, setRound] = useState(0);
  // This page's restores, so each new revision carries "vraćeno iz verzije N" (PIL-D7-OBNOVA). They
  // live here, not in the list below: a read of the list that fails hides the list, never the labels
  // (INT-21). Client-only: the evidence contract has no place for them yet.
  const [restored, setRestored] = useState<readonly RestoredLabel[]>([]);
  const next = useRef(0);
  // The waiting and the later receipt are said here, in one status area that outlives the list.
  const [announced, setAnnounced] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void history.versions(documentId)
      .then((read) => { if (active) setVersions(read.kind === "ready" ? read.versions : null); })
      .catch(() => { if (active) setVersions(null); });
    return () => { active = false; };
  }, [documentId, history, round]);

  const record = (from: number, confirmed: boolean) => {
    const at = next.current++;
    setRestored((labels) => recordRestored(labels, at, from, confirmed));
    setAnnounced(confirmed ? null : text.pending);
    if (confirmed) return;
    // Pending: the label turns confirmed when the server's receipt comes, and the list is read again.
    // No upper bound on purpose: each ask already waits on its own (CONFIRM_WITHIN_MS), and the text
    // stays in the sheet and the journal, so the page keeps asking while it is open.
    void awaitRestoreReceipt(real, () => mounted.current).then((ok) => {
      if (!ok || !mounted.current) return;
      setRestored((labels) => confirmRestored(labels, at));
      setAnnounced(text.confirmedLater(from));
      setRound((n) => n + 1);
      onRestored?.();
    });
  };

  const labels = (
    <>
      <p role="status">{announced}</p>
      {restored.length > 0 ? (
        <ul aria-label={text.restoredList}>
          {restored.map((r) => (
            <li key={r.at} data-restored-from={r.from} data-confirmed={r.confirmed}>
              {r.confirmed ? text.restoredVersion(r.from) : text.restoredPending(r.from)}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  // Without a list there is nothing to restore; the history above already says why.
  if (versions === null) return labels;
  return (
    <>
      <RestoreVersion
        documentId={documentId}
        versions={versions}
        port={real}
        onRecorded={record}
        onRestored={() => { setRound((n) => n + 1); onRestored?.(); }}
        onStale={() => setRound((n) => n + 1)}
      />
      {labels}
    </>
  );
}
