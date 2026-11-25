"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Dialog, RouteLoading, TextArea } from "@ductura/ui";

import type { createApi } from "@/client/api";
import { teacherPeerReviewText as t } from "./messages.hr";
import { checkReason, fullName, inNameOrder, mayWithdraw, type ReasonError } from "./model";
import { readOverview, withdrawReview, type Allocation, type OverviewView, type Read } from "./read";

type Api = ReturnType<typeof createApi>;

/**
 * WEB-V19-RECENZIJA-NASTAVNIK: "Dodjele" of one assignment (peer-review.teacher-overview.get): both ends of every
 * allocation, in the order of the reviewer's name and nothing else, with the state as a fact and no total, mark
 * or list by quality. A sent review may be withdrawn with a reason (peer-review.review-withdrawal.post); the
 * contract gives the teacher no text of a review, so none is shown and the page says so. The list is read again
 * after any answer. A standalone component, mounted by OverviewPage; `version` asks for a new read.
 */
export function OverviewPanel({ assignmentId, call, version, onSignedOut }: {
  assignmentId: string; call: () => Api; version: number; onSignedOut: () => void;
}) {
  const [read, setRead] = useState<Read<OverviewView> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<(Allocation & { reviewId: string }) | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<ReasonError | null>(null);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    void readOverview(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") onSignedOut();
      setRead(result);
    });
    return () => { live = false; };
    // `call` and `onSignedOut` are stable per visit; the attempt and the round's version ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId, version]);

  const close = () => { if (!busy) { setTarget(null); setReason(""); setError(null); } };

  async function withdraw() {
    if (busy || target === null) return;
    const checked = checkReason(reason);
    if (checked.error !== null) { setError(checked.error); return; }
    setError(null);
    setBusy(true);
    const outcome = await withdrawReview(call(), assignmentId, target.reviewId, checked.reason);
    setBusy(false);
    if (outcome.kind === "signedOut") { onSignedOut(); return; }
    setTarget(null);
    setReason("");
    if (outcome.kind === "done") setNote({ tone: "status", text: t.withdraw.done });
    else {
      const text = outcome.kind === "notFound" ? t.withdraw.notFound : outcome.kind === "conflict" || outcome.kind === "already" ? t.withdraw.conflict : t.withdraw.unknown;
      setNote({ tone: "alert", text });
    }
    setAttempt((n) => n + 1);
  }

  if (read === null || read.kind === "signedOut") return <Card level={2} title={t.overview.title}><RouteLoading label={t.loading} /></Card>;
  if (read.kind !== "ok") {
    return (
      <Card level={2} title={t.overview.title}>
        <p role="alert">{read.kind === "notFound" ? t.gone : t.unavailable}</p>
        {read.kind === "unavailable" && <p><Button tone="quiet" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{t.retry}</Button></p>}
      </Card>
    );
  }
  const rows = inNameOrder(read.value.allocations);
  return (
    <Card level={2} title={t.overview.title}>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <p>{t.overview.lead}</p>
      <p>{t.overview.unreadable}</p>
      {rows.length === 0 ? <p data-testid="overview-none">{t.overview.none}</p> : (
        <ul>
          {rows.map((a, index) => (
            <li key={`${a.reviewer.id}-${a.author.id}-${index}`} data-testid="allocation">
              <span>{t.overview.reviewer}: {fullName(a.reviewer)}</span>{" · "}
              <span>{t.overview.author}: {fullName(a.author)}</span>{" · "}
              <span data-testid="allocation-state">{t.overview.state[a.state]}</span>{" "}
              {mayWithdraw(a) && (
                <Button tone="quiet" aria-label={t.overview.withdrawAria.replace("{reviewer}", fullName(a.reviewer)).replace("{author}", fullName(a.author))}
                  onClick={() => { setNote(null); setTarget(a); }}>{t.overview.withdraw}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={target !== null} title={t.withdraw.title} onClose={close} dismissible={!busy} initialFocus={field}
        actions={<>
          <Button tone="secondary" disabled={busy} onClick={close}>{t.withdraw.no}</Button>
          <Button busy={busy} onClick={() => void withdraw()}>{t.withdraw.yes}</Button>
        </>}>
        <p>{t.withdraw.body}</p>
        <TextArea ref={field} label={t.withdraw.reason} hint={t.withdraw.reasonHint} value={reason} error={error === null ? undefined : t.withdraw.errors[error]}
          onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </Card>
  );
}
