"use client";

// ED-15 (NF2-P8): the requested proofs at the top of the Izvori card. Open while any request is open,
// so the student sees what the mentor waits for without looking for it.
import { Button, Details } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { liveRequests, openRows, type RequestsRead } from "./proof-requests";
import { liveRecommended, type RecommendedRead } from "./recommended-sources";
import { proofRequestsHr as t, recommendedSourcesHr as r12 } from "./messages.hr";
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

export function RecommendedSourcesView({ read, onRetry }: { read: RecommendedRead; onRetry: () => void }) {
  return <section aria-label={r12.title} data-recommended-sources>
    <strong>{r12.title}</strong>
    {read.kind === "loading" ? <p role="status">{r12.loading}</p>
      : read.kind === "signedOut" ? <p role="alert">{r12.signedOut}</p>
      : read.kind === "unavailable" ? <div role="alert">
        <p><b>{r12.error}</b></p>
        <Button tone="quiet" onClick={onRetry}>{r12.retry}</Button>
      </div>
      : read.sources.length === 0 ? <p>{r12.none}</p>
      : <>
        <ul className={styles.list}>
          {read.sources.map((s) => <li key={s.id} className={styles.item}>
            <b>{s.label}</b>
            {s.title !== "" && s.title !== s.label && <span>{s.title}</span>}
            <small>{s.requirement === "required" ? r12.required : r12.recommended}</small>
          </li>)}
        </ul>
        <p><small>{r12.only}</small></p>
      </>}
  </section>;
}

export function RecommendedSources({ assignmentId, read = liveRecommended }: {
  assignmentId: string;
  read?: (assignmentId: string) => Promise<RecommendedRead>;
}) {
  const [state, setState] = useState<RecommendedRead>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void read(assignmentId).then((next) => { if (live) setState(next); });
    return () => { live = false; };
  }, [assignmentId, read, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return <RecommendedSourcesView read={state} onRetry={retry} />;
}
