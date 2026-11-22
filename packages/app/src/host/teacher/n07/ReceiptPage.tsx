"use client";

import { Button, Details, KeyValueList, Skeleton } from "@ductura/ui";
import { useEffect, useState } from "react";

import { goToSignIn } from "@/client/api";
import { readTeacherWorkReceipt } from "@/client/teacher-work";
import { appHref } from "@/components/shell/nav";
import { SUMMARY_ANCHOR } from "@/components/teacher/LiveWorkFrame";
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

const rows = (list: readonly Row[]) => list.map(({ id, label, value }) => ({ id, label, value }));

/** The prototype's `qr()` sample: finder squares and the data cells, hidden from assistive technology. */
function QrSample({ hex }: { hex: string }) {
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <path d={`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`} fillRule="evenodd" />
      <rect x={x + 2} y={y + 2} width={3} height={3} />
    </g>
  );
  return (
    <svg viewBox="0 0 21 21" width={84} height={84} aria-hidden="true" focusable="false" fill="currentColor" shapeRendering="crispEdges">
      {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
      <path d={qrCells(hex)} />
    </svg>
  );
}

/** `po-h`: the receipt as the student got it, in the variants the server's read gives. */
export function ReceiptPanel({ view, onRetry, onCopy, verifyHref }: {
  view: ReceiptView; onRetry: () => void; onCopy: (hex: string) => void; verifyHref: (path: string) => string;
}) {
  if (view.kind === "loading") {
    return <section className="panel"><p aria-hidden="true">{text.loading}</p><Skeleton label={text.loading} /></section>;
  }
  if (view.kind === "error") {
    return <section className="panel"><p role="alert">{text.error}</p><Button tone="quiet" onClick={onRetry}>{text.retry}</Button></section>;
  }
  if (view.kind === "notFound") return <section className="panel"><p role="alert">{text.notFound}</p></section>;
  if (view.kind === "notSubmitted") return <section className="panel"><p role="status">{view.body}</p></section>;
  if (view.kind === "pending") {
    return (
      <section aria-labelledby="po-h" className="panel">
        <h2 id="po-h">{view.title}</h2>
        <p role="status">{view.body}</p>
        <KeyValueList items={rows(view.rows)} />
        <Button tone="quiet" onClick={onRetry}>{text.check}</Button>
      </section>
    );
  }
  return (
    <section aria-labelledby="po-h" className="panel">
      <h2 id="po-h">{view.title}</h2>
      <KeyValueList items={rows(view.rows)} />
      <Details summary={text.utc}>
        <KeyValueList items={view.utc.map(({ id, label, value }) => ({ id, label, value: <code>{value}</code> }))} />
      </Details>
      <h3>{text.fingerprintTitle}</h3>
      <p><code>{view.groups}</code></p>
      <p>{text.fingerprintNote}</p>
      <Button tone="quiet" onClick={() => onCopy(view.fingerprint)}>{text.copy}</Button>
      <KeyValueList items={[{ id: "record", label: text.record, value: <>{view.record} {text.recordKept}</> }]} />
      <p>{text.verifyNote}</p>
      {view.verifyPath !== null && <p><a href={verifyHref(view.verifyPath)}>{text.verifyLink}</a></p>}
      <QrSample hex={view.fingerprint} />
      <p>{text.qrNote}</p>
    </section>
  );
}

/** "Zatraži doradu": the dd-h dialog when a route carries it, otherwise said as unavailable (B-6). */
function RevisionAction({ documentId, port, onDone }: { documentId: string; port: RevisionPort; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const post = port.returnForRevision;
  if (post === null) return <p role="status">{text.revisionUnavailable}</p>;
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
  const summaryHref = `${workHref}#${SUMMARY_ANCHOR}`;
  const name = input?.kind === "ready" ? input.studentName : null;

  return (
    <div className="page">
      <p><a href={workHref}>{text.backToWork}</a>{name !== null && <> · {name}</>}</p>
      <section className="panel">
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </section>
      {submitted && <PreSubmitPanel outcome={summary.outcome} summaryHref={summaryHref} onReload={() => void summary.load()} />}
      <ReceiptPanel view={view} onRetry={retry} onCopy={copy} verifyHref={(path) => appHref(base, path)} />
      {submitted && showFallback(fallbackKey(view)) && <FallbackPanel fallback={{ kind: "unavailable" }} />}
      {input?.kind === "ready" && <AiDeclarationSection submissionId={documentId} />}
      {view.kind !== "loading" && view.kind !== "notFound" && (
        <div>
          <a href={workHref}>{text.backToWork}</a>
          {(view.kind === "submitted" || view.kind === "pending") && <RevisionAction documentId={documentId} port={port} onDone={() => toasts.show(text.revisionDone)} />}
          {view.kind !== "notSubmitted" && <a href={appHref(base, "/nastavnik/brz-put")}>{text.fastPath}</a>}
        </div>
      )}
      <TeacherToastRegion toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}
