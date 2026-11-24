"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Dialog, RouteLoading } from "@ductura/ui";

import { createApi, goToSignIn } from "../../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../../src/components/editor/EarlierDraft";
import { appHref } from "../../../../../../../src/components/shell/nav";
import { useHost } from "../../../context";
import type { StateRead, WithdrawCall } from "./contract";
import { withdrawText as t } from "./messages.hr";
import { canWithdraw, opensOnArrival, readWithdrawalState, receiptFile, receiptLine, withdraw, WITHDRAW_HASH, type Note } from "./model";
import type { WithdrawalReceipt } from "./contract";

/** Saves the signed confirmation from the browser's memory through the shared download; no request is made. */
function downloadReceipt(receipt: WithdrawalReceipt): void {
  const file = receiptFile(receipt);
  downloadBlob(new Blob([file.content], { type: file.type }), file.filename);
}

/** The routes are the server's own (student.submission-withdrawal.get and .post, SRV-2005), served by createApi from the contract excerpt. */
const defaultCall = () => createApi() as unknown as WithdrawCall;

/**
 * Student: "Povuci predaju" (WEB-1903; P-D3). The button is shown only while the server says the
 * submission can be withdrawn; it opens a confirmation that says the withdrawal is recorded. A
 * note follows only the server's answer (B-6), and every signed confirmation can be downloaded.
 * `call` is for tests; the page uses the client.
 */
export default function WithdrawSubmission({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => WithdrawCall }) {
  const { base } = useHost();
  const here = appHref(base, `/rad/${encodeURIComponent(assignmentId)}/predaja/potvrda`);
  const [read, setRead] = useState<StateRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [kept, setKept] = useState<readonly WithdrawalReceipt[]>([]);

  useEffect(() => {
    let live = true;
    void readWithdrawalState(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "session-expired") goToSignIn(here);
      setRead(result);
      // E-7a (R-55): "Povuci predaju" in the workspace's banner leads here and opens the confirmation, once.
      if (result.kind === "ready" && opensOnArrival(window.location.hash, result.state)) {
        window.history.replaceState(window.history.state, "", window.location.href.replace(`#${WITHDRAW_HASH}`, ""));
        setAsking(true);
      }
    });
    return () => { live = false; };
    // `call` and `here` are stable per mount; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, attempt]);

  const confirm = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const followup = await withdraw(call(), assignmentId);
    setBusy(false);
    setAsking(false);
    if (followup === null) { goToSignIn(here); return; }
    setNote(followup.note);
    if (followup.receipt !== undefined) setKept((list) => [...list, followup.receipt as WithdrawalReceipt]);
    if (followup.refresh) setAttempt((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, assignmentId, here]);

  if (read === null || read.kind === "session-expired") return <RouteLoading label={t.loading} />;
  const shownReceipts = (read.kind === "ready" ? read.state.receipts : []).concat(
    kept.filter((k) => !(read.kind === "ready" && read.state.receipts.some((r) => r.withdrawalId === k.withdrawalId))),
  );
  if (read.kind === "nepoznato") {
    return (
      <Card level={2} title={t.title}>
        {note !== null && note.tone === "status" && <p role="status">{note.text}</p>}
        <p role="alert">{t.unavailable}</p>
        <Receipts receipts={shownReceipts} />
        <p><Button tone="quiet" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{t.retry}</Button></p>
      </Card>
    );
  }
  const { state } = read;
  return (
    <Card level={2} title={t.title}>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      {canWithdraw(state)
        ? (
          <>
            <p>{t.lead}</p>
            <p><Button tone="quiet" onClick={() => setAsking(true)}>{t.withdraw}</Button></p>
          </>
        )
        : <p>{t.closed}</p>}
      <Receipts receipts={shownReceipts} />
      <Dialog open={asking} title={t.dialogTitle} dismissible={!busy} onClose={() => setAsking(false)}
        actions={(
          <>
            <Button tone="quiet" disabled={busy} onClick={() => setAsking(false)}>{t.cancel}</Button>
            <Button busy={busy} onClick={() => void confirm()}>{busy ? t.withdrawing : t.confirm}</Button>
          </>
        )}>
        <p>{t.explain}</p>
      </Dialog>
    </Card>
  );
}

function Receipts({ receipts }: { receipts: readonly WithdrawalReceipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <section aria-labelledby="withdraw-receipts-h">
      <h3 id="withdraw-receipts-h">{t.receiptsTitle}</h3>
      <ul>
        {receipts.map((receipt) => (
          <li key={receipt.withdrawalId} data-testid="withdrawal-receipt">
            {receiptLine(receipt)}{" "}
            <Button tone="quiet" aria-label={receipt.revision === null ? t.downloadForNoRevision : t.downloadFor.replace("{revision}", String(receipt.revision))}
              onClick={() => downloadReceipt(receipt)}>{t.download}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
