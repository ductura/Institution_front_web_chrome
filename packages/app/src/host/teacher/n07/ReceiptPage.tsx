"use client";

import { Button, Details } from "@ductura/ui";
import { useEffect, useState } from "react";

import { goToSignIn } from "@/client/api";
import { readTeacherWorkReceipt } from "@/client/teacher-work";
import { appHref } from "@/components/shell/nav";
import { useProcessSummary } from "@/components/teacher/SummaryCard";
import ReturnForRevisionDialog from "@/components/teacher/revision/ReturnForRevisionDialog";

import { useHost } from "../../context";
import { LIVE_PORT, type RevisionPort } from "../../editor/work/review/review-model";
import AiDeclarationSection from "../ai-declaration/AiDeclarationSection";
import { FallbackPanel, PreSubmitPanel } from "../pre-submit/PreSubmitPanel";
import { showFallback } from "../pre-submit/model";
import { TeacherToastRegion, useTeacherToasts } from "../toast";
import { fallbackKey, isSubmittedRead, qrCells, receiptView, type ReceiptInput, type ReceiptView, type Row } from "./model";
import { n07Messages as text } from "./messages.hr";
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

/** "Zatraži doradu": the dd-h dialog when a route carries it, otherwise said as unavailable (B-6). */
function RevisionAction({ documentId, port, onDone }: { documentId: string; port: RevisionPort; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const post = port.returnForRevision;
  if (post === null) return <span className="note" role="status">{text.revisionUnavailable}</span>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{text.revision}</Button>
      <ReturnForRevisionDialog documentId={documentId} today={today} post={post} open={open}
        onClose={() => setOpen(false)} onSent={() => { setOpen(false); onDone(); }} />
    </>
  );
}

/**
 * N-07 "Što je student predao" (WEB-2155): the frame, "Prije predaje", the receipt, the declaration and the
 * teacher's buttons. Reads only through src/client; the copy toast follows the browser's own answer.
 */
export default function N07ReceiptPage({ documentId, workHref, current, port = LIVE_PORT }: {
  documentId: string; workHref: string; current: () => boolean; port?: RevisionPort;
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

  const retry = () => { setInput(null); setAttempt((n) => n + 1); };
  const copy = (hex: string) => {
    void navigator.clipboard.writeText(hex)
      .then(() => toasts.show(text.copied), () => toasts.show(text.copyFailed, "error"));
  };
  const submitted = isSubmittedRead(input);
  const summary = useProcessSummary(documentId, current, submitted);
  const view = receiptView(input);
  // N-10 (WEB-2157): the process summary is its own page under the work.
  const summaryHref = `${workHref}/sazetak`;
  const name = input?.kind === "ready" ? input.studentName : null;

  const full = view.kind === "pending" || view.kind === "submitted";
  const back = <a className="btn secondary" href={workHref}>{text.backToWork}</a>;
  return (
    <WorkPage back={workHref} backLabel={text.backToWork} crumb={name ?? undefined}>
      {full && (
        <section className="panel">
          <div className={styles.body}>
            <h1 className={styles.intro}>{text.title}</h1>
            <p className="note">{text.intro}</p>
          </div>
        </section>
      )}
      {submitted && <PreSubmitPanel outcome={summary.outcome} summaryHref={summaryHref} onReload={() => void summary.load()} />}
      <ReceiptPanel view={view} onRetry={retry} onCopy={copy} verifyHref={(path) => appHref(base, path)} />
      {submitted && showFallback(fallbackKey(view)) && <FallbackPanel fallback={{ kind: "unavailable" }} />}
      {input?.kind === "ready" && <AiDeclarationSection submissionId={documentId} />}
      {(full || view.kind === "notSubmitted") && (
        <div className={styles.acts}>
          {back}
          {full && <RevisionAction documentId={documentId} port={port} onDone={() => toasts.show(text.revisionDone)} />}
          {full && <a className="btn secondary" href={appHref(base, "/nastavnik/brz-put")}>{text.fastPath}</a>}
        </div>
      )}
      <TeacherToastRegion toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </WorkPage>
  );
}
