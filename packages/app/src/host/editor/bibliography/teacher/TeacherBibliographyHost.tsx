"use client";

// WEB-2133 (paritet E, PRIJEDLOG br. 11, nastavnički dio): the teacher's Izvori
// card beside the student's work (INVENTAR-editor §2.4 sources2.js). It reads
// the newest saved version of the work and shows the literature overview with
// "novo" and "Označi literaturu pregledanom", and the citations whose proof the
// mentor asked for. Recommending a source, the mandatory course literature and
// requesting or withdrawing a proof have no route in the contract: their
// buttons are off and say "nedostupno". A collaborator only reads.
import { Button, Card, DataTable, Details, Dialog, Tag, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { readWorkLiterature, type LiteratureRead } from "./literature-read";
import { hrDate, hrDay, overviewRows, overviewSummary, readSeen, writeSeen, type LitSeen, type OverviewRow } from "./literature-model";
import { bibliographyTeacherHr as t } from "./messages.hr";

export type TeacherBibliographyRole = "teacher" | "collaborator";

export type TeacherBibliographyProps = {
  documentId: string;
  role?: TeacherBibliographyRole;
  /** The work is submitted: nothing new is sent to the student. */
  submitted?: boolean;
  /** The read of the literature; the live routes when not given (tests pass their own). */
  read?: (documentId: string) => Promise<LiteratureRead>;
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

function Bibliography({ documentId, role = "teacher", submitted = false, read = readWorkLiterature, today = () => new Date() }: TeacherBibliographyProps) {
  const [state, setState] = useState<LiteratureRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [overview, setOverview] = useState(false);
  const [seen, setSeen] = useState<LitSeen | null>(() => readSeen(documentId));
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    setState(null);
    void read(documentId).catch((): LiteratureRead => ({ kind: "unavailable" })).then((next) => { if (live) setState(next); });
    return () => { live = false; };
  }, [documentId, read, attempt]);
  useEffect(() => setSeen(readSeen(documentId)), [documentId]);

  const literature = state?.kind === "ready" ? state.literature : null;
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const markSeen = () => {
    if (!literature) return;
    const next = { when: hrDate(today()), ids: literature.sources.map((s) => s.id) };
    setSeen(next);
    writeSeen(documentId, next);
    setMessage(t.markedSeen);
  };

  return <LiteratureView state={state} role={role} submitted={submitted} seen={seen} overview={overview} message={message}
    onRetry={retry} onOverview={(next) => { setMessage(""); setOverview(next); }} onMarkSeen={markSeen} />;
}

export type LiteratureViewProps = {
  state: LiteratureRead | null;
  role: TeacherBibliographyRole;
  submitted: boolean;
  seen: LitSeen | null;
  overview: boolean;
  message: string;
  onRetry: () => void;
  onOverview: (open: boolean) => void;
  onMarkSeen: () => void;
};

/** What the card draws for one read; no state of its own beyond ids. */
export function LiteratureView({ state, role, submitted, seen, overview, message, onRetry, onOverview, onMarkSeen }: LiteratureViewProps) {
  const noteId = useId();
  const teacher = role === "teacher";
  const sends = teacher && !submitted;
  const literature = state?.kind === "ready" ? state.literature : null;
  const rows = useMemo(() => (literature ? overviewRows(literature, seen) : []), [literature, seen]);

  if (state === null) return <p role="status">{t.loading}</p>;
  if (state.kind === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (state.kind === "unavailable") {
    return <div><p role="alert">{t.unavailable}</p><Button tone="quiet" onClick={onRetry}>{t.retry}</Button></div>;
  }

  const columns: DataTableColumn<OverviewRow>[] = [
    { id: "source", header: t.colSource, rowHeader: true, sortValue: (r) => r.label, cell: (r) => <>
      <b>{r.label}</b>{r.fresh && <> <Tag tone="accent">{t.fresh}</Tag></>}<br /><small>{r.title}</small>
    </> },
    { id: "kind", header: t.colKind, sortValue: (r) => r.kind, cell: (r) => r.kind },
    { id: "cites", header: t.colCites, numeric: true, sortValue: (r) => r.cites, cell: (r) => String(r.cites) },
  ];
  const requests = literature?.requests ?? [];

  return (
    <div>
      {state.kind === "ready" ? <p>{t.basis(hrDay(state.savedMinute))}</p> : <p role="status">{t.noVersion}</p>}
      {!teacher && <p>{t.readOnly}</p>}
      {teacher && submitted && <p>{t.submitted}</p>}
      <div role="group" aria-label={t.heading}>
        {sends && <Button tone="quiet" disabled aria-describedby={`${noteId}-rec`}>{t.recommend}</Button>}
        <Button tone="quiet" disabled={literature === null} onClick={() => onOverview(true)}>{t.overview}</Button>
      </div>
      {sends && <p id={`${noteId}-rec`}>{t.recommendUnavailable}</p>}

      {literature && <Card title={t.requests}>
        <p>{requests.length > 0 ? t.requestsWaiting(requests.length) : t.requestsNone}</p>
        {requests.length > 0 && <ul>{requests.map((r, i) => <li key={`${r.rq}:${i}`}>{t.requestPlace(r.label, r.page)}</li>)}</ul>}
        {sends && <p>{t.requestUnavailable}</p>}
      </Card>}

      <Details summary={t.recommended}><p>{t.recommendUnavailable}</p></Details>
      <Details summary={t.mandatory}>
        <p id={`${noteId}-ob`}>{t.mandatoryUnavailable}</p>
        {sends && <Button tone="quiet" disabled aria-describedby={`${noteId}-ob`}>{t.mandatoryAdd}</Button>}
      </Details>

      <Dialog open={overview} title={t.overview} onClose={() => onOverview(false)} actions={<>
        {teacher && <Button tone="quiet" disabled={literature === null} onClick={onMarkSeen}>{t.markSeen}</Button>}
        <Button onClick={() => onOverview(false)}>{t.close}</Button>
      </>}>
        <p>{overviewSummary(rows, seen)}</p>
        <DataTable caption={t.overview} columns={columns} rows={rows} rowKey={(r) => r.id} empty={t.empty} />
        <p>{t.proofsUnavailable}</p>
        {teacher && <p>{t.seenDevice}</p>}
        {message && <p role="status">{message}</p>}
      </Dialog>
    </div>
  );
}
