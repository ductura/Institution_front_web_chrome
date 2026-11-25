"use client";

// ED-15 (NF2-P8): the requested proofs at the top of the Izvori card. Open while any request is open,
// so the student sees what the mentor waits for without looking for it.
import { Button, Details } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { liveRequests, openRows, type RequestsRead } from "./proof-requests";
import { proofRequestsHr as t } from "./messages.hr";
import styles from "./ProofRequests.module.css";

type Source = { readonly id: string; readonly label: string };

export function ProofRequestsView({ read, sources, now, onRetry }: { read: RequestsRead; sources: readonly Source[]; now: number; onRetry: () => void }) {
  const rows = read.kind === "ready" ? openRows(read.requests, sources, now) : [];
  const total = read.kind === "ready" ? read.requests.length : 0;
  return <Details summary={rows.length > 0 ? t.titleOpen(rows.length) : t.title} open={rows.length > 0 || undefined} data-proof-requests>
    {read.kind === "loading" ? <p role="status">{t.loading}</p>
      : read.kind === "unavailable" ? <div role="alert">
        <p><b>{t.error}</b></p>
        <Button tone="quiet" onClick={onRetry}>{t.retry}</Button>
      </div>
      : <>
        <p>{total === 0 ? t.none : rows.length === 0 ? t.allDone : t.open(rows.length, total)}</p>
        {rows.length > 0 && <ul className={styles.list}>
          {rows.map((r) => <li key={r.id} className={styles.item}>
            <b>{t.item(r.label)}</b>
            {r.instruction !== "" && <span>{r.instruction}</span>}
            {r.due !== "" && <small>{r.overdue ? t.overdue(r.due) : t.due(r.due)}</small>}
          </li>)}
        </ul>}
        {rows.length > 0 && <p><small>{t.how}</small></p>}
        <p><small>{t.only}</small></p>
      </>}
  </Details>;
}

export function ProofRequests({ assignmentId, sources, read = liveRequests }: {
  assignmentId: string;
  sources: readonly Source[];
  read?: (assignmentId: string) => Promise<RequestsRead>;
}) {
  const [state, setState] = useState<RequestsRead>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void read(assignmentId).then((next) => { if (live) setState(next); });
    return () => { live = false; };
  }, [assignmentId, read, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return <ProofRequestsView read={state} sources={sources} now={Date.now()} onRetry={retry} />;
}
