"use client";

import { Button, Details, KeyValueList, StateTag } from "@ductura/ui";
import { useState, type ReactNode } from "react";

import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import { browserTransport, goToSignIn } from "../../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../../src/components/editor/EarlierDraft";
import { fetchRecord } from "../../portable-record/model";
import { verifyHref } from "../../../public/verify/model";
import { fingerprintGroups, receiptView, type Row } from "./model";
import { receiptText as t } from "./messages.hr";

export type ReceiptScreenProps = {
  readonly read: ReceiptRead;
  readonly retryHref: string;
  /** Where a work without a receipt goes on (the workspace). */
  readonly workHref: string;
  readonly homeHref: string;
  /** The public check /provjera under the base (WEB-2111); without it the section says the check is not available. */
  readonly checkHref?: string;
  /** The process summary: not in the contract yet, so the host passes the "unavailable" panel. */
  readonly summary?: ReactNode;
};

const items = (rows: readonly Row[], code = false) =>
  rows.map((r) => ({ id: r.id, label: r.label, value: code ? <code>{r.value}</code> : r.value }));

/** Sample pattern only; it carries no content and is never read as a code. */
function QrSample() {
  const cells = Array.from({ length: 49 }, (_, i) => (i * 7 + (i >> 3)) % 3 !== 0);
  return (
    <svg role="img" aria-label={t.qrLabel} width="84" height="84" viewBox="0 0 7 7">
      {cells.map((on, i) => on ? <rect key={i} x={i % 7} y={Math.floor(i / 7)} width="1" height="1" fill="currentColor" /> : null)}
    </svg>
  );
}

function Fingerprint({ value }: { value: string }) {
  const [note, setNote] = useState<string | null>(null);
  const groups = fingerprintGroups(value);
  if (groups === null) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setNote(t.copied); } catch { setNote(t.copyFailed); }
  };
  return (
    <section aria-labelledby="receipt-fp">
      <h3 id="receipt-fp">{t.fingerprintTitle}</h3>
      <code>{groups.map((g, i) => <span key={i}>{g} </span>)}</code>
      <p>{t.fingerprintNote}</p>
      <p><Button tone="quiet" onClick={() => { void copy(); }}>{t.copy}</Button></p>
      {note !== null && <p role="status">{note}</p>}
    </section>
  );
}

function RecordDownload({ submissionId }: { submissionId: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setProblem(null);
    const { state, file } = await fetchRecord(submissionId, { baseUrl: window.location.origin, transport: browserTransport });
    setBusy(false);
    if (state === "signedOut") return goToSignIn(window.location.pathname);
    if (file !== null) downloadBlob(new Blob([file.bytes], { type: file.type }), file.filename);
    else if (state.kind === "error") setProblem(state.message);
  };
  return (
    <>
      <p><Button tone="quiet" busy={busy} onClick={() => { void run(); }}>{busy ? t.pdfLoading : t.pdf}</Button></p>
      {problem !== null && <p role="alert">{problem}</p>}
    </>
  );
}

/** E-11 in every variant of the prototype; "Predano" only with the signed receipt (B-6). */
export default function ReceiptScreen({ read, retryHref, workHref, homeHref, checkHref, summary }: ReceiptScreenProps) {
  const [open, setOpen] = useState(false);
  const view = receiptView(read);
  if (view.kind === "loading") return <p role="status">{t.loading}</p>;
  if (view.kind === "error") {
    return <div className="receipt"><p role="alert">{t.error}</p><p><a href={retryHref}>{t.retry}</a></p></div>;
  }
  if (view.kind === "none") {
    return <div className="receipt"><p role="status">{t.empty}</p><p><a href={workHref}>{t.toWork}</a></p></div>;
  }
  if (view.kind === "ceka") {
    return (
      <div className="receipt">
        <h2>{view.title}</h2>
        <p><StateTag state="pending" /></p>
        <p role="status">{view.lead}</p>
        <KeyValueList items={items(view.rows)} />
        <Details summary={t.utc}><KeyValueList items={items(view.utc, true)} /></Details>
        <p><a href={retryHref}>{t.check}</a></p>
        <p><a href={workHref}>{t.toWork}</a></p>
      </div>
    );
  }
  const submissionId = read.kind === "potvrdeno" ? read.receipt.payload.submissionId : "";
  return (
    <div className="receipt">
      <h2>{view.title}</h2>
      <p>
        <StateTag state="submitted" />
        {view.afterDeadline && <StateTag state="late" />}
        {view.gaps && <StateTag state="gap" />}
      </p>
      <KeyValueList items={items(view.rows)} />
      <Details summary={t.utc}><KeyValueList items={items(view.utc, true)} /></Details>
      <Fingerprint value={view.fingerprint} />
      {view.gaps && <p role="note">{t.gaps}</p>}
      <p>
        <button type="button" aria-expanded={open} aria-controls="receipt-summary" onClick={() => setOpen(!open)}>
          {open ? t.closeSummary : t.openSummary}
        </button>
      </p>
      <section id="receipt-summary" hidden={!open} aria-label={t.summaryTitle}>
        {summary ?? <p role="status">{t.summaryUnavailable}</p>}
      </section>
      <section aria-labelledby="receipt-verify">
        <h3 id="receipt-verify">{t.verifyTitle}</h3>
        <p>{t.verifyLead}</p>
        {checkHref === undefined
          ? <p role="note">{t.verifyUnavailable}</p>
          : <p><a href={verifyHref(checkHref, submissionId, view.fingerprint)}>{t.verifyTitle}</a></p>}
      </section>
      <div><QrSample /><p>{t.qrNote}</p></div>
      <RecordDownload submissionId={submissionId} />
      <p><a href={homeHref}>{t.home}</a></p>
    </div>
  );
}
