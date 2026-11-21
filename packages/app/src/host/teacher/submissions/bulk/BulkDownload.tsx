"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import type { BulkCall, BulkRead, BulkStatus } from "./contract";
import { readBulkStatus, requestBulkPreparation } from "./contract";
import { bulkText as t } from "./messages.hr";
import { failureMessage, requestFailure, viewOf } from "./model";

/**
 * The button "Preuzmi sve predaje" of the submissions table (WEB-1902; P-D2): the state of the
 * preparation and the expiry of the link, both as the server states them. An assignment without
 * submissions shows the empty state and no button. The submissions screen mounts it above the table.
 */
export default function BulkDownload(
  { call, assignmentId, now = () => new Date(), onSignedOut }: { call: BulkCall; assignmentId: string; now?: () => Date; onSignedOut?: () => void },
) {
  const [state, setState] = useState<{ assignmentId: string; read: BulkRead } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const read = state?.assignmentId === assignmentId ? state.read : null;

  useEffect(() => {
    setBusy(false);
    setNote(null);
    let live = true;
    void readBulkStatus(call, assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "session-expired") onSignedOut?.();
      setState({ assignmentId, read: next });
    });
    return () => { live = false; };
  }, [call, assignmentId, attempt, onSignedOut]);

  if (read === null) return <p role="status">{t.loading}</p>;
  if (read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{failureMessage(read)}</p>
        <Button tone="quiet" onClick={() => { setState(null); setAttempt((n) => n + 1); }}>{t.retry}</Button>
      </div>
    );
  }

  async function prepare() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const asked = assignmentId;
    const outcome = await requestBulkPreparation(call, asked);
    setBusy(false);
    if (outcome.kind === "zaprimljeno") setState((cur) => (cur?.assignmentId === asked ? { assignmentId: asked, read: { kind: "ready", status: outcome.status as BulkStatus } } : cur));
    else if (outcome.kind === "session-expired") onSignedOut?.();
    else setNote(requestFailure(outcome));
  }

  const view = viewOf(read.status, now());
  return (
    <section aria-labelledby="bulk-download-h">
      <h3 id="bulk-download-h">{t.title}</h3>
      {view.kind === "empty" && <p>{t.empty}</p>}
      {view.kind === "idle" && (
        <>
          <p>{t.idle}</p>
          <Button onClick={() => void prepare()} disabled={busy}>{t.action}</Button>
        </>
      )}
      {view.kind === "preparing" && (
        <>
          <p role="status">{t.preparing}</p>
          <Button tone="quiet" onClick={() => { setState(null); setAttempt((n) => n + 1); }}>{t.refresh}</Button>
        </>
      )}
      {view.kind === "ready" && (
        <>
          <p role="status">{t.ready}</p>
          <a href={view.href} download>{t.download}</a>
          <p>{t.expiresAt} {view.until}.</p>
        </>
      )}
      {view.kind === "expired" && (
        <>
          <p role="alert">{t.expired}</p>
          <Button onClick={() => void prepare()} disabled={busy}>{t.prepareAgain}</Button>
        </>
      )}
      {busy && <p role="status">{t.requesting}</p>}
      {note !== null && <p role="alert">{note}</p>}
    </section>
  );
}
