"use client";

import {
  Button, StepActions, StepDetails, StepKv, StepLoading, StepMono, StepNav, StepPanel, StepQr, StepSub, ToastRegion, useToasts,
} from "@ductura/ui";
import { useState, type ReactNode } from "react";

import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import { browserTransport, goToSignIn } from "../../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../../src/components/editor/EarlierDraft";
import { fetchRecord } from "../../portable-record/model";
import { verifyHref } from "../../../public/verify/model";
import StepLink from "../steps/StepLink";
import { fingerprintGroups, receiptView, type Row } from "./model";
import { receiptText as t } from "./messages.hr";

export type ReceiptScreenProps = {
  readonly read: ReceiptRead;
  readonly retryHref: string;
  /** A repeated read of the receipt; without it the page is opened again at `retryHref`. */
  readonly onRetry?: () => void;
  /** Where a work without a receipt goes on (the workspace). */
  readonly workHref: string;
  readonly homeHref: string;
  /** The public check /provjera under the base (WEB-2111); without it the section says the check is not available. */
  readonly checkHref?: string;
  /** The process summary: not in the contract yet, so the host passes the "unavailable" panel. */
  readonly summary?: ReactNode;
  /** The kind of work, the tag beside the title, when the server names it. */
  readonly kind?: string;
};

const kvs = (rows: readonly Row[]) => rows.map((r) => <StepKv key={r.id} label={r.label}>{r.value}</StepKv>);

function Utc({ rows }: { rows: readonly Row[] }) {
  return (
    <StepDetails summary={t.utc}>
      <StepMono>{rows.map((r, i) => <span key={r.id}>{i > 0 && <br />}{`${r.label} ${r.value}`}</span>)}</StepMono>
    </StepDetails>
  );
}

function RecordDownload({ submissionId, onProblem }: { submissionId: string; onProblem: (message: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    onProblem(null);
    const { state, file } = await fetchRecord(submissionId, { baseUrl: window.location.origin, transport: browserTransport });
    setBusy(false);
    if (state === "signedOut") return goToSignIn(window.location.pathname);
    if (file !== null) downloadBlob(new Blob([file.bytes], { type: file.type }), file.filename);
    else if (state.kind === "error") onProblem(state.message);
  };
  return <StepLink href="#potvrda" onClick={() => { if (!busy) void run(); }}>{busy ? t.pdfLoading : t.pdf}</StepLink>;
}

/** E-11 in every variant of the prototype; "Predano" only with the signed receipt (B-6). */
export default function ReceiptScreen({ read, retryHref, onRetry, workHref, homeHref, checkHref, summary, kind }: ReceiptScreenProps) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { toasts, show, dismiss } = useToasts();
  const view = receiptView(read);
  const home = <StepActions><LinkButton href={homeHref}>{t.home}</LinkButton></StepActions>;
  if (view.kind === "loading") return <StepPanel title={t.panelTitle} busy><StepLoading message={t.loading} /></StepPanel>;
  if (view.kind === "error") {
    return (
      <StepPanel title={t.panelTitle}>
        <p className="note" role="alert">{t.error}</p>
        <StepActions><Button tone="secondary" onClick={() => { if (onRetry) onRetry(); else window.location.assign(retryHref); }}>{t.retry}</Button></StepActions>
      </StepPanel>
    );
  }
  if (view.kind === "none") {
    return (
      <StepPanel title={t.panelTitle}>
        <p className="note">{t.empty}</p>
        <StepLink href={workHref}>{t.toWork}</StepLink>
      </StepPanel>
    );
  }
  if (view.kind === "ceka") {
    return (
      <>
        <div><StepNav current={5} /></div>
        <StepPanel title={view.title} tag={kind}>
          <p className="note" role="status">{view.lead}</p>
          {kvs(view.rows)}
          <StepLink href={retryHref}>{t.check}</StepLink>
          <StepLink href={workHref}>{t.toWork}</StepLink>
          {home}
        </StepPanel>
      </>
    );
  }
  const submissionId = read.kind === "potvrdeno" ? read.receipt.payload.submissionId : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(view.fingerprint); show(t.copiedToast); } catch { show(t.copyFailed); }
  };
  const groups = fingerprintGroups(view.fingerprint);
  return (
    <>
      <div><StepNav current={5} /></div>
      <StepPanel title={view.title} tag={kind}>
        {kvs(view.rows)}
        <Utc rows={view.utc} />
        {groups !== null && (
          <>
            <StepSub>{t.fingerprintTitle}</StepSub>
            <StepMono>{groups.join(" ")}</StepMono>
            <p className="meta">{t.fingerprintNote}</p>
            <StepActions><Button tone="secondary" onClick={() => { void copy(); }}>{t.copy}</Button></StepActions>
          </>
        )}
        {view.gaps && <p className="note">{t.gaps}</p>}
        <StepLink href="#potvrda" aria-expanded={open} aria-controls="sb-sum-h" onClick={() => setOpen(!open)}>
          {open ? t.closeSummary : t.openSummary}
        </StepLink>
        <p className="note">{t.verifyLead}</p>
        {checkHref === undefined
          ? <p className="note" role="note">{t.verifyUnavailable}</p>
          : <StepLink href={verifyHref(checkHref, submissionId, view.fingerprint)}>{t.verifyTitle}</StepLink>}
        <StepQr>{t.qrNote}</StepQr>
        <RecordDownload submissionId={submissionId} onProblem={setProblem} />
        {problem !== null && <p className="note" role="alert">{problem}</p>}
        {home}
        <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.toastLabel} closeLabel={t.toastClose} />
      </StepPanel>
      {open && (summary ?? (
        <StepPanel id="sb-sum-h" level={2} title={t.summaryOpenedTitle} tag={kind}>
          <p className="note" role="status">{t.summaryUnavailable}</p>
        </StepPanel>
      ))}
    </>
  );
}

/** "Na početnu": a secondary button that is a link (the prototype's `data-go="pocetna"`). */
function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return <a className="btn secondary" href={href}>{children}</a>;
}
