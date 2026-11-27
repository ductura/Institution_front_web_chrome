"use client";

import { Button, Details } from "@ductura/ui";
import { useEffect, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { readTeacherWorkReceiptPdf, type ReceiptPdfRead, type SubmissionsCall } from "@/client/teacher-submissions";
import { readTeacherWorkReceipt } from "@/client/teacher-work";
import { appHref } from "@/components/shell/nav";
import { useProcessSummary } from "@/components/teacher/SummaryCard";

import { downloadBlob } from "@/components/editor/EarlierDraft";

import { useHost } from "../../context";
import AiDeclarationSection from "../ai-declaration/AiDeclarationSection";
import { FallbackPanel, PreSubmitPanel } from "../pre-submit/PreSubmitPanel";
import { showFallback } from "../pre-submit/model";
import { RevisionSection } from "../revision";
import { PracticeNotice } from "../submissions/grade/GradeGate";
import { TeacherToastRegion, useTeacherToasts } from "../toast";
import { fallbackKey, isSubmittedRead, qrCells, receiptView, type ReceiptInput, type ReceiptView, type Row } from "./model";
import { n07Messages as text } from "./messages.hr";
import { readWorkPractice, type PracticeCall } from "./practice";
import { useTaskCrumb } from "../n06/task-context";
import { Kv, StateBlock, WorkPage, WorkPanel, workPageStyles as styles } from "./WorkPage";

const rows = (list: readonly Row[]) => list.map(({ id, label, value }) => <Kv key={id} label={label}>{value}</Kv>);

/** The prototype's `qr()` sample: finder squares and the data cells, hidden from assistive technology. */
function QrSample({ hex }: { hex: string }) {
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <path d={`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`} fillRule="evenodd" />
      <rect x={x + 2} y={y + 2} width={3} height={3} />
    </g>
  );
  return (
    <svg viewBox="0 0 21 21" aria-hidden="true" focusable="false" fill="currentColor" shapeRendering="crispEdges">
      {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
      <path d={qrCells(hex)} />
    </svg>
  );
}

/** The prototype's `skel` lines of a loading work panel (`loadingBody`). */
const Lines = () => <><div className="skel w80" /><div className="skel w60" /><div className="skel w40" /></>;

/** `po-h`: the receipt as the student got it, in the variants the server's read gives (prototype `receiptPanel`, `workState`). */
export function ReceiptPanel({ view, onRetry, onCopy, verifyHref }: {
  view: ReceiptView; onRetry: () => void; onCopy: (hex: string) => void; verifyHref: (path: string) => string;
}) {
  if (view.kind === "loading") {
    return <WorkPanel id="pg-h" title={text.title} busy><p className="note" role="status">{text.loading}</p><Lines /></WorkPanel>;
  }
  if (view.kind === "error") {
    return (
      <WorkPanel id="pg-h" title={text.title}>
        <p className="note" role="alert">{text.error}</p>
        <div className={styles.acts}><Button tone="secondary" onClick={onRetry}>{text.retry}</Button></div>
      </WorkPanel>
    );
  }
  if (view.kind === "notFound") return <WorkPanel id="pg-h" title={text.title}><p className="note" role="alert">{text.notFound}</p></WorkPanel>;
  if (view.kind === "notSubmitted") return <WorkPanel id="pg-h" title={text.title}><p className="note" role="status">{view.body}</p></WorkPanel>;
  if (view.kind === "pending") {
    return (
      <WorkPanel id="po-h" title={view.title} level={2}>
        <p className="note" role="status">{view.body}</p>
        {rows(view.rows)}
        <div className={styles.acts}><Button tone="secondary" onClick={onRetry}>{text.check}</Button></div>
      </WorkPanel>
    );
  }
  return (
    <WorkPanel id="po-h" title={view.title} level={2}>
      {rows(view.rows)}
      <Details summary={text.utc}>
        <p className={styles.mono}>{view.utc.map(({ id, label, value }, i) => <span key={id}>{i > 0 && <br />}{label} {value}</span>)}</p>
      </Details>
      <h3 className="sub">{text.fingerprintTitle}</h3>
      <p className={styles.mono}>{view.groups}</p>
      <p className="meta">{text.fingerprintNote}</p>
      <div className={styles.acts}><Button tone="secondary" onClick={() => onCopy(view.fingerprint)}>{text.copy}</Button></div>
      <StateBlock title={text.record}><span>{view.record}</span><span className="meta">{text.recordKept}</span></StateBlock>
      <p className="note">{text.verifyNote}</p>
      {view.verifyPath !== null && <a href={verifyHref(view.verifyPath)}>{text.verifyLink}</a>}
      <div className={styles.qr}><QrSample hex={view.fingerprint} /><p className="meta">{text.qrNote}</p></div>
    </WorkPanel>
  );
}

/** The real read of "Preuzmi PDF potvrde" (teacher.receipt-pdf.get); a prop so the page can be driven without a server. */
const realPdf = (documentId: string): Promise<ReceiptPdfRead> => readTeacherWorkReceiptPdf(createApi() as unknown as SubmissionsCall, documentId);

/**
 * N-07 "Što je student predao" (WEB-2155): the frame, "Prije predaje", the receipt, the declaration and the
 * teacher's buttons. "Zatraži doradu" is the dd-h dialog of RevisionSection (NAS-38, F4-NAS-R07), the same as on N-06.
 * Reads only through src/client; the copy toast follows the browser's own answer.
 */
export default function N07ReceiptPage({ documentId, workHref, current, loadPdf = realPdf }: {
  documentId: string; workHref: string; current: () => boolean; loadPdf?: (documentId: string) => Promise<ReceiptPdfRead>;
}) {
  const { base } = useHost();
  const here = `${workHref}/predaja`;
  const [attempt, setAttempt] = useState(0);
  const [input, setInput] = useState<ReceiptInput>(null);
  const toasts = useTeacherToasts();
  useEffect(() => {
    let active = true;
    void readTeacherWorkReceipt(documentId, () => active && current()).then((read) => {
      if (!active || !current()) return;
      if (read.kind === "signedOut") goToSignIn(here);
      setInput(read);
    });
    return () => { active = false; };
  }, [documentId, here, attempt, current]);

  // P-D1: a practice assignment is never graded; the receipt says so calmly (no error, no grade action).
  const [practice, setPractice] = useState(false);
  useEffect(() => {
    let active = true;
    setPractice(false);
    void readWorkPractice(createApi() as unknown as PracticeCall, documentId).then((next) => { if (active && current()) setPractice(next); });
    return () => { active = false; };
  }, [documentId, current]);

  const retry = () => { setInput(null); setAttempt((n) => n + 1); };
  const copy = (hex: string) => {
    void navigator.clipboard.writeText(hex)
      .then(() => toasts.show(text.copied), () => toasts.show(text.copyFailed, "error"));
  };
  const [pdfBusy, setPdfBusy] = useState(false);
  const savePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    const outcome = await loadPdf(documentId);
    setPdfBusy(false);
    if (!current()) return;
    if (outcome.kind === "session-expired") return goToSignIn(here);
    if (outcome.kind === "notFound") return toasts.show(text.pdfNotFound, "error");
    if (outcome.kind === "failed") return toasts.show(text.pdfFailed, "error");
    try { downloadBlob(outcome.blob, outcome.filename); toasts.show(text.pdfSaved); } catch { toasts.show(text.pdfFailed, "error"); }
  };
  const submitted = isSubmittedRead(input);
  const summary = useProcessSummary(documentId, current, submitted);
  const view = receiptView(input);
  // N-10 (WEB-2157): the process summary is its own page under the work.
  const summaryHref = `${workHref}/sazetak`;
  const name = input?.kind === "ready" ? input.studentName : null;
  // F4-NAS-R12: "Student · Seminarski rad „Naslov”" once read; until then, or when the work cannot be read, the name alone.
  const crumb = useTaskCrumb(documentId) ?? name ?? undefined;

  const full = view.kind === "pending" || view.kind === "submitted";
  const back = <a className="btn secondary" href={workHref}>{text.backToWork}</a>;
  return (
    <RevisionSection documentId={documentId} current={current}>
      {(rev) => (
    <WorkPage back={workHref} backLabel={text.backToWork} crumb={crumb}>
      {full && (
        <section className="panel">
          <div className={styles.body}>
            <h1 className={styles.intro}>{text.title}</h1>
            <p className="note">{text.intro}</p>
          </div>
        </section>
      )}
      {full && rev.banner}
      {practice && <PracticeNotice />}
      {submitted && <PreSubmitPanel outcome={summary.outcome} summaryHref={summaryHref} onReload={() => void summary.load()} />}
      <ReceiptPanel view={view} onRetry={retry} onCopy={copy} verifyHref={(path) => appHref(base, path)} />
      {submitted && showFallback(fallbackKey(view)) && <FallbackPanel fallback={{ kind: "unavailable" }} />}
      {input?.kind === "ready" && <AiDeclarationSection submissionId={documentId} />}
      {(full || view.kind === "notSubmitted") && (
        <div className={styles.acts}>
          {back}
          {view.kind === "submitted" && <Button tone="secondary" disabled={pdfBusy} onClick={() => void savePdf()}>{pdfBusy ? text.pdfLoading : text.pdf}</Button>}
          {full && rev.action}
          {full && <a className="btn secondary" href={appHref(base, "/nastavnik/brz-put")}>{text.fastPath}</a>}
        </div>
      )}
      <TeacherToastRegion toasts={toasts.toasts} onDismiss={toasts.dismiss} />
      {rev.dialog}
    </WorkPage>
      )}
    </RevisionSection>
  );
}
