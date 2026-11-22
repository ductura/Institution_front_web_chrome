"use client";

// WEB-2133 (paritet E, PRIJEDLOG br. 11, nastavnički dio): the teacher's Izvori
// card beside the student's work (INVENTAR-editor §2.4 sources2.js). It reads
// the newest saved version of the work and shows the literature overview with
// "novo" and "Označi literaturu pregledanom", and the citations whose proof the
// mentor asked for. WEB-2133B turns on the buttons left "nedostupno": recommend a
// source, mandatory literature, request or withdraw a proof, read the proofs and
// the review mark, all through the SRV-1605 routes (guidance.ts). A collaborator
// only reads.
import { Button, Card, DataTable, Details, Dialog, SourceForm, Tag, TextArea, TextField, type DataTableColumn, type SourceDraft } from "@ductura/ui";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import * as live from "./guidance";
import type { Guidance, GuidanceRead, ProofsRead, Requirement, WriteResult } from "./guidance";
import styles from "./Literature.module.css";
import { readWorkLiterature, type LiteratureRead } from "./literature-read";
import { hrDate, hrDay, overviewRows, overviewSummary, readSeen, writeSeen, type LitSeen, type OverviewRow } from "./literature-model";
import { bibliographyTeacherHr as t } from "./messages.hr";

export type Ports = {
  read: (documentId: string) => Promise<GuidanceRead>;
  proofs: (documentId: string, sourceId: string) => Promise<ProofsRead>;
  recommend: (documentId: string, draft: SourceDraft, requirement: Requirement, id: string) => Promise<WriteResult>;
  remove: (documentId: string, sourceId: string) => Promise<WriteResult>;
  request: (documentId: string, sourceId: string, instruction: string, dueAt: string) => Promise<WriteResult>;
  withdraw: (documentId: string, sourceId: string) => Promise<WriteResult>;
  markSeen: (documentId: string) => Promise<WriteResult>;
};
const LIVE: Ports = {
  read: (d) => live.readGuidance(d), proofs: (d, s) => live.readProofs(d, s),
  recommend: (d, draft, r, id) => live.recommendSource(d, draft, r, id), remove: (d, s) => live.removeRecommendation(d, s),
  request: (d, s, i, due) => live.requestProof(d, s, i, due), withdraw: (d, s) => live.withdrawProof(d, s), markSeen: (d) => live.markLiteratureSeen(d),
};

/** The one open dialog of the card besides the overview. */
export type Dialogue = { kind: "recommend"; requirement: Requirement } | { kind: "request"; sourceId: string } | { kind: "proofs"; sourceId: string };

export type TeacherBibliographyRole = "teacher" | "collaborator";

export type TeacherBibliographyProps = {
  documentId: string;
  role?: TeacherBibliographyRole;
  /** The work is submitted: nothing new is sent to the student. */
  submitted?: boolean;
  /** The read of the literature; the live routes when not given (tests pass their own). */
  read?: (documentId: string) => Promise<LiteratureRead>;
  /** Reads and writes of the source tools; the live routes when not given. */
  guidance?: Ports;
  /** Today, for the review mark (tests pass a fixed day). */
  today?: () => Date;
  /** Starts open (catalogue and tests). */
  defaultOpen?: boolean;
};

export function TeacherBibliographyHost(props: TeacherBibliographyProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return <Details summary={t.heading} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    {open && <Bibliography {...props} />}
  </Details>;
}

function Bibliography({ documentId, role = "teacher", submitted = false, read = readWorkLiterature, guidance: ports = LIVE, today = () => new Date() }: TeacherBibliographyProps) {
  const [state, setState] = useState<LiteratureRead | null>(null);
  const [guided, setGuided] = useState<Guidance | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [overview, setOverview] = useState(false);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [proofs, setProofs] = useState<ProofsRead | null>(null);
  const [seen, setSeen] = useState<LitSeen | null>(() => readSeen(documentId));
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  useEffect(() => {
    let live = true;
    setState(null);
    void read(documentId).catch((): LiteratureRead => ({ kind: "unavailable" })).then((next) => { if (live) setState(next); });
    void ports.read(documentId).catch((): GuidanceRead => ({ kind: "unavailable" }))
      .then((next) => { if (live) setGuided(next.kind === "ready" ? next.guidance : null); });
    return () => { live = false; };
  }, [documentId, read, ports, attempt]);
  useEffect(() => setSeen(readSeen(documentId)), [documentId]);

  const literature = state?.kind === "ready" ? state.literature : null;
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The server keeps only the time of the review; the sources known by then are the reviewed ones.
  const reviewed: LitSeen | null = seen ?? (guided?.seenAt
    ? { when: hrDay(guided.seenAt), ids: guided.sources.filter((s) => s.createdAt <= guided.seenAt!).map((s) => s.id) } : null);

  const run = async (done: string, write: () => Promise<WriteResult>, close = true) => {
    setMessage(""); setProblem("");
    const result = await write();
    if (result === "ok") { setMessage(done); if (close) setDialogue(null); retry(); } else setProblem(result === "signedOut" ? t.signedOut : t.writeFailed);
    return result;
  };
  const markSeen = async () => {
    if (!literature) return;
    const next = { when: hrDate(today()), ids: literature.sources.map((s) => s.id) };
    if (await run(t.markedSeen, () => ports.markSeen(documentId), false) === "ok") { setSeen(next); writeSeen(documentId, next); }
  };
  const open = (next: Dialogue | null) => {
    setProblem(""); setProofs(null); setDialogue(next);
    if (next?.kind === "proofs") void ports.proofs(documentId, next.sourceId).catch((): ProofsRead => ({ kind: "unavailable" })).then(setProofs);
  };

  return <LiteratureView state={state} role={role} submitted={submitted} seen={reviewed} overview={overview} message={message}
    guidance={guided} dialogue={dialogue} proofs={proofs} problem={problem} today={today}
    onRetry={retry} onOverview={(next) => { setMessage(""); setOverview(next); }} onMarkSeen={() => void markSeen()}
    onDialogue={open}
    onRecommend={(draft, requirement) => void run(t.recommended_ok, () => ports.recommend(documentId, draft, requirement, crypto.randomUUID()))}
    onRemove={(id) => void run(t.removed, () => ports.remove(documentId, id), false)}
    onRequest={(id, instruction, dueAt) => void run(t.requested, () => ports.request(documentId, id, instruction, dueAt))}
    onWithdraw={(id) => void run(t.withdrawn, () => ports.withdraw(documentId, id), false)} />;
}

export type LiteratureViewProps = {
  state: LiteratureRead | null;
  role: TeacherBibliographyRole;
  submitted: boolean;
  seen: LitSeen | null;
  overview: boolean;
  message: string;
  guidance?: Guidance | null;
  dialogue?: Dialogue | null;
  proofs?: ProofsRead | null;
  problem?: string;
  today?: () => Date;
  onRetry: () => void;
  onOverview: (open: boolean) => void;
  onMarkSeen: () => void;
  onDialogue?: (next: Dialogue | null) => void;
  onRecommend?: (draft: SourceDraft, requirement: Requirement) => void;
  onRemove?: (sourceId: string) => void;
  onRequest?: (sourceId: string, instruction: string, dueAt: string) => void;
  onWithdraw?: (sourceId: string) => void;
};

const nothing = () => {};

/** What the card draws for one read; no state of its own beyond ids. */
export function LiteratureView({ state, role, submitted, seen, overview, message, guidance = null, dialogue = null, proofs = null, problem = "",
  today = () => new Date(), onRetry, onOverview, onMarkSeen, onDialogue = nothing, onRecommend = nothing, onRemove = nothing, onRequest = nothing, onWithdraw = nothing }: LiteratureViewProps) {
  const noteId = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const teacher = role === "teacher";
  // Sending needs the guidance read (the route says whether this teacher may write) and an open work.
  const sends = teacher && !submitted && guidance?.canWrite === true;
  const literature = state?.kind === "ready" ? state.literature : null;
  const rows = useMemo(() => (literature ? overviewRows(literature, seen) : []), [literature, seen]);

  if (state === null) return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (state.kind === "signedOut") return <p role="alert" className={styles.alert}>{t.signedOut}</p>;
  if (state.kind === "unavailable") {
    return <div className={styles.root}><p role="alert" className={styles.alert}>{t.unavailable}</p><Button tone="secondary" size="dense" onClick={onRetry}>{t.retry}</Button></div>;
  }

  const columns: DataTableColumn<OverviewRow>[] = [
    { id: "source", header: t.colSource, rowHeader: true, sortValue: (r) => r.label, cell: (r) => <>
      <b>{r.label}</b>{r.fresh && <> <Tag tone="accent">{t.fresh}</Tag></>}<br /><small>{r.title}</small>
    </> },
    { id: "kind", header: t.colKind, sortValue: (r) => r.kind, cell: (r) => r.kind },
    { id: "cites", header: t.colCites, numeric: true, sortValue: (r) => r.cites, cell: (r) => String(r.cites) },
  ];
  const requests = literature?.requests ?? [];
  const sources = guidance?.sources ?? [];
  const labelOf = (id: string) => sources.find((s) => s.id === id)?.label ?? id;
  const openRequests = (guidance?.requests ?? []).filter((r) => r.closedAt === null);
  const listed = (requirement: Requirement) => sources.filter((s) => s.requirement === requirement);
  const recommending = dialogue?.kind === "recommend" ? dialogue.requirement : null;

  return (
    <div className={styles.root}>
      {state.kind === "ready" ? <p className={styles.muted}>{t.basis(hrDay(state.savedMinute))}</p> : <p role="status" className={styles.muted}>{t.noVersion}</p>}
      {!teacher && <p className={styles.muted}>{t.readOnly}</p>}
      {teacher && submitted && <p className={styles.muted}>{t.submitted}</p>}
      {message && !overview && <p role="status">{message}</p>}
      {problem && !overview && !dialogue && <p role="alert" className={styles.alert}>{problem}</p>}
      <div className={styles.row} role="group" aria-label={t.heading}>
        {teacher && !submitted && <Button ref={anchor} tone="secondary" size="dense" disabled={!sends} aria-describedby={`${noteId}-rec`}
          onClick={() => onDialogue({ kind: "recommend", requirement: "recommended" })}>{t.recommend}</Button>}
        <Button tone="secondary" size="dense" disabled={literature === null} onClick={() => onOverview(true)}>{t.overview}</Button>
      </div>
      {teacher && !submitted && !sends && <p id={`${noteId}-rec`}>{t.recommendUnavailable}</p>}

      {literature && <Card title={t.requests}>
        <p>{requests.length > 0 ? t.requestsWaiting(requests.length) : t.requestsNone}</p>
        {requests.length > 0 && <ul>{requests.map((r, i) => <li key={`${r.rq}:${i}`}>{t.requestPlace(r.label, r.page)}</li>)}</ul>}
        {openRequests.length > 0 && <ul>{openRequests.map((r) => <li key={r.id}>
          {t.requestOpen(labelOf(r.sourceId), hrDay(r.dueAt), r.instruction)}
          {sends && <> <Button tone="secondary" size="dense" onClick={() => onWithdraw(r.sourceId)}>{t.withdraw}</Button></>}
        </li>)}</ul>}
      </Card>}

      {([["recommended", t.recommended], ["required", t.mandatory]] as const).map(([requirement, heading]) => <Details className={styles.rpd} key={requirement} summary={heading}>
        {listed(requirement).length === 0 ? <p>{requirement === "recommended" ? t.recommendedNone : t.mandatoryNone}</p>
          : <ul>{listed(requirement).map((s) => <li key={s.id}>{s.label}{sends && <> <Button tone="secondary" size="dense" onClick={() => onRemove(s.id)}>{t.remove}</Button></>}</li>)}</ul>}
        {requirement === "required" && teacher && !submitted && <Button tone="secondary" size="dense" disabled={!sends}
          onClick={() => onDialogue({ kind: "recommend", requirement: "required" })}>{t.mandatoryAdd}</Button>}
      </Details>)}

      {sources.length > 0 && <Details className={styles.rpd} summary={t.workSources}>
        <ul>{sources.map((s) => <li key={s.id}>{s.label}{" "}
          <Button tone="secondary" size="dense" onClick={() => onDialogue({ kind: "proofs", sourceId: s.id })}>{t.proofsOf(s.proofCount)}</Button>
          {sends && <> <Button tone="secondary" size="dense" onClick={() => onDialogue({ kind: "request", sourceId: s.id })}>{t.request}</Button></>}
        </li>)}</ul>
      </Details>}

      <Dialog open={recommending !== null} title={recommending === "required" ? t.mandatoryAdd : t.recommend} onClose={() => onDialogue(null)}>
        {recommending && <SourceForm open floating={false} anchor={anchor} disabled={!sends} error={problem || undefined}
          onClose={() => onDialogue(null)} onSubmit={(draft) => onRecommend(draft, recommending)} />}
      </Dialog>
      <Dialog open={dialogue?.kind === "request"} title={t.request} onClose={() => onDialogue(null)}>
        {dialogue?.kind === "request" && <RequestForm sourceLabel={labelOf(dialogue.sourceId)} today={today} problem={problem}
          onCancel={() => onDialogue(null)} onSend={(instruction, dueAt) => onRequest(dialogue.sourceId, instruction, dueAt)} />}
      </Dialog>
      <Dialog open={dialogue?.kind === "proofs"} title={t.proofsTitle} onClose={() => onDialogue(null)}
        actions={<Button onClick={() => onDialogue(null)}>{t.close}</Button>}>
        {dialogue?.kind === "proofs" && <>
          <p>{labelOf(dialogue.sourceId)}</p>
          {proofs === null ? <p role="status">{t.loading}</p> : proofs.kind !== "ready" ? <p role="alert">{proofs.kind === "signedOut" ? t.signedOut : t.proofsFailed}</p>
            : proofs.proofs.length === 0 ? <p>{t.proofsNone}</p>
            : <ul>{proofs.proofs.map((p) => <li key={p.id}>{t.proofPlace(p.page)}{p.note && <>: {p.note}</>}</li>)}</ul>}
        </>}
      </Dialog>

      <Dialog open={overview} title={t.overview} onClose={() => onOverview(false)} actions={<>
        {teacher && <Button tone="secondary" size="dense" disabled={literature === null} onClick={onMarkSeen}>{t.markSeen}</Button>}
        <Button onClick={() => onOverview(false)}>{t.close}</Button>
      </>}>
        <p>{overviewSummary(rows, seen)}</p>
        <DataTable caption={t.overview} columns={columns} rows={rows} rowKey={(r) => r.id} empty={t.empty} />
        {teacher && <p>{t.seenDevice}</p>}
        {message && <p role="status">{message}</p>}
        {problem && <p role="alert">{problem}</p>}
      </Dialog>
    </div>
  );
}

function RequestForm({ sourceLabel, today, problem, onCancel, onSend }: {
  sourceLabel: string; today: () => Date; problem: string; onCancel: () => void; onSend: (instruction: string, dueAt: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const now = today();
    const earliest = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (instruction.trim() === "" || instruction.length > 1000) return setError(t.instructionInvalid);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < earliest) return setError(t.dueInvalid);
    setError("");
    onSend(instruction.trim(), `${day}T23:59:59.000Z`);
  };
  return <div>
    <p>{sourceLabel}</p>
    <TextArea label={t.instruction} value={instruction} maxLength={1000} onChange={(e) => setInstruction(e.currentTarget.value)} />
    <TextField type="date" label={t.due} value={day} onChange={(e) => setDay(e.currentTarget.value)} error={error || undefined} />
    {problem && <p role="alert">{problem}</p>}
    <Button onClick={submit}>{t.requestSend}</Button> <Button tone="secondary" size="dense" onClick={onCancel}>{t.cancel}</Button>
  </div>;
}
