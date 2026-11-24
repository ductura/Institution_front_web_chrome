"use client";

import {
  Button, StepActions, StepDetails, StepKv, StepLoading, StepMono, StepNav, StepPanel, StepQr, StepSection, StepSub, ToastRegion, useToasts,
} from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import { createApi, goToSignIn } from "../../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../../src/components/editor/EarlierDraft";
import { verifyHref } from "../../../public/verify/model";
import PortfolioExport from "../../portfolio/PortfolioExport";
import type { PortfolioPort } from "../../portfolio/model";
import { browserPortfolioPort } from "../../portfolio/port";
import StepLink from "../steps/StepLink";
import { fingerprintGroups, receiptPath, receiptView, type Row } from "./model";
import { receiptText as t } from "./messages.hr";
import { receiptPdf, type PdfOutcome } from "./pdf";

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
  /** The process summary (PD-1) of the submitted work, a panel with the id `sb-sum-h`; without it the panel says it is unavailable. */
  readonly summary?: ReactNode;
  /** NF-3 PR-11: the lines of "Što je predano" (given.ts); without them the block is not shown. */
  readonly given?: readonly string[];
  /** NF-3 PR-12: the receipt's PDF (student.receipt-pdf.get); the real read by default. */
  readonly loadPdf?: (assignmentId: string) => Promise<PdfOutcome>;
  /** The kind of work, the tag beside the title, when the server names it. */
  readonly kind?: string;
  /** The list of submitted versions for "Izvoz za portfelj"; made only when the section is opened. */
  readonly portfolioPort?: () => PortfolioPort;
};

const kvs = (rows: readonly Row[]) => rows.map((r) => <StepKv key={r.id} label={r.label}>{r.value}</StepKv>);

function Utc({ rows }: { rows: readonly Row[] }) {
  return (
    <StepDetails summary={t.utc}>
      <StepMono>{rows.map((r, i) => <span key={r.id}>{i > 0 && <br />}{`${r.label} ${r.value}`}</span>)}</StepMono>
    </StepDetails>
  );
}

const realPdf = (assignmentId: string) => receiptPdf(createApi(), assignmentId);

/**
 * NF-3 PR-12 (E-11a): "Sačuvaj potvrdu", one section with the one record the student saves in the
 * pilot, the PDF with the QR code (answer 1: no package for the registrar, no portable record).
 */
function SaveReceipt({ assignmentId, loadPdf }: { assignmentId: string; loadPdf: (assignmentId: string) => Promise<PdfOutcome> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    setBusy(true);
    setFailed(false);
    const outcome = await loadPdf(assignmentId);
    setBusy(false);
    if (outcome.kind === "signedOut") return goToSignIn(window.location.pathname);
    if (outcome.kind === "failed") return setFailed(true);
    try { downloadBlob(outcome.blob, outcome.filename); } catch { setFailed(true); }
  };
  return (
    <StepSection id="sb-save" label={t.saveTitle} heading>
      <p className="note">{t.saveLead}</p>
      {failed && <p className="note" role="alert">{t.downloadFailed}</p>}
      <StepLink href="#potvrda" aria-disabled={busy || undefined} onClick={() => { if (!busy) void run(); }}>{busy ? t.pdfLoading : t.pdf}</StepLink>
    </StepSection>
  );
}

/** "Izvoz za portfelj" on this page; after sign-in the student comes back to this receipt (`here`). */
function Portfolio({ make, here }: { make: () => PortfolioPort; here: string }) {
  const [port] = useState(make);
  return <StepPanel id="sb-portfolio" level={2} title={t.portfolioOpen}><PortfolioExport port={port} here={here} /></StepPanel>;
}

/** E-11 in every variant of the prototype; "Predano" only with the signed receipt (B-6). */
export default function ReceiptScreen({
  read, retryHref, onRetry, workHref, homeHref, checkHref, summary, kind, given, loadPdf = realPdf, portfolioPort = browserPortfolioPort,
}: ReceiptScreenProps) {
  const [open, setOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  // NF-3 PR-11, PR-18 (R-67): the opened summary is brought into view and its title takes the focus.
  useEffect(() => {
    if (!open) return;
    const heading = document.getElementById("sb-sum-h");
    if (heading === null) return;
    heading.setAttribute("tabindex", "-1");
    heading.scrollIntoView?.({ block: "start" });
    heading.focus();
  }, [open]);
  const { toasts, show, dismiss } = useToasts();
  const view = receiptView(read);
  const home = <StepActions><LinkButton href={homeHref}>{t.home}</LinkButton></StepActions>;
  if (view.kind === "loading") return <StepPanel title={t.panelTitle} busy><StepLoading message={t.loading} /></StepPanel>;
  if (view.kind === "error") {
    return (
      <StepPanel title={t.panelTitle}>
        <p className="note" role="alert">{t.error}</p>
        <StepActions>{onRetry ? <Button tone="secondary" onClick={onRetry}>{t.retry}</Button> : <a className="btn secondary" href={retryHref}>{t.retry}</a>}</StepActions>
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
  const assignmentId = read.kind === "potvrdeno" ? read.receipt.payload.assignmentId : "";
  const here = read.kind === "potvrdeno" ? receiptPath(read.receipt.payload.assignmentId) : "/";
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
            {/* NF-3 PR-18: the groups are for the eye; a screen reader reads the whole string once, not sixteen words. */}
            <div aria-hidden="true"><StepMono>{groups.join(" ")}</StepMono></div>
            <p className="visually-hidden">{view.fingerprint}</p>
            <p className="meta">{t.fingerprintNote}</p>
            <StepActions><Button tone="secondary" onClick={() => { void copy(); }}>{t.copy}</Button></StepActions>
          </>
        )}
        {given !== undefined && (
          <StepSection id="sb-given" label={t.givenTitle} heading>
            <ul className="facts">{given.map((line) => <li key={line}>{line}</li>)}</ul>
          </StepSection>
        )}
        {view.gaps && <p className="note">{t.gaps}</p>}
        <StepLink href="#potvrda" aria-expanded={open} aria-controls="sb-sum-h" onClick={() => setOpen(!open)}>
          {open ? t.closeSummary : t.openSummary}
        </StepLink>
        <p className={open ? "meta" : "visually-hidden"} role="status">{open ? t.summaryOpened : ""}</p>
        <p className="note">{t.verifyLead}</p>
        {checkHref === undefined
          ? <p className="note" role="note">{t.verifyUnavailable}</p>
          : <StepLink href={verifyHref(checkHref, submissionId, view.fingerprint)}>{t.verifyTitle}</StepLink>}
        <StepQr>{t.qrNote}</StepQr>
        <SaveReceipt assignmentId={assignmentId} loadPdf={loadPdf} />
        <StepLink href="#potvrda" aria-expanded={portfolioOpen} aria-controls="sb-portfolio" onClick={() => setPortfolioOpen(!portfolioOpen)}>
          {portfolioOpen ? t.portfolioClose : t.portfolioOpen}
        </StepLink>
        {home}
        <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.toastLabel} closeLabel={t.toastClose} />
      </StepPanel>
      {portfolioOpen && <Portfolio make={portfolioPort} here={here} />}
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
