"use client";

import { Button, DataTable, type DataTableColumn } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import type { ListOutcome } from "../../../../../../../src/client/comments";
import type { DisputeListOutcome } from "../../../../../../../src/client/event-disputes";
import type { DraftsRead } from "../../comment-bank/model";
import type { OriginRead } from "../../provenance/origin";
import { givenRows, hasUnknown, compositionRows, importantPlaces, noteRows, type CompositionRow, type GivenRow, type NoteRow, type Place } from "./pg-model";
import { pgMessages as t } from "./pg-messages.hr";
import type { ReviewReads } from "./read";
import type { ReviewExtras } from "./extras";

/** Reads once per key; a retry reads again. A read that throws is an error, never a blank. */
function useRead<T>(read: () => Promise<T>, key: string): [T | null, () => void] {
  const [value, setValue] = useState<T | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setValue(null);
    void read().then((next) => { if (live) setValue(next); }, () => undefined);
    return () => { live = false; };
    // `read` is rebuilt on every render; the key names what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return [value, () => setAttempt((n) => n + 1)];
}

const Retry = ({ onRetry }: { onRetry: () => void }) => <Button tone="secondary" size="small" onClick={onRetry}>{t.retry}</Button>;

// ---- PG-3 ----

const COMPOSITION_COLUMNS: readonly DataTableColumn<CompositionRow>[] = [
  { id: "kind", header: t.colKind, cell: (row) => row.label },
  { id: "share", header: t.colShare, cell: (row) => row.share },
  { id: "means", header: t.colMeans, cell: (row) => row.means },
  { id: "notMeans", header: t.colNotMeans, cell: (row) => row.notMeans },
];

export function CompositionView({ read, onRetry }: { read: OriginRead | null; onRetry: () => void }) {
  let body: ReactNode;
  if (read === null) body = <p className="meta" role="status">{t.compositionLoading}</p>;
  else if (read.kind === "empty") body = <p className="note">{t.compositionEmpty}</p>;
  else if (read.kind === "notFound") body = <p className="note">{t.compositionNotGiven}</p>;
  else if (read.kind === "signedOut") body = null;
  else if (read.kind === "unavailable") body = <><p className="note" role="alert">{t.compositionUnavailable}</p><Retry onRetry={onRetry} /></>;
  else body = (
    <>
      <DataTable caption={t.compositionCaption} columns={COMPOSITION_COLUMNS} rows={compositionRows(read.composition)} rowKey={(row) => row.kind} empty={t.compositionEmpty} />
      {hasUnknown(read.composition) && <p className="note" data-unknown-notice>{t.unknownNotice}</p>}
    </>
  );
  return (
    <section aria-labelledby="pg3-h" data-nf5="PG-3" data-state={read === null ? "loading" : read.kind}>
      <h3 id="pg3-h">{t.compositionHeading}</h3>
      <p className="note">{t.compositionIntro}</p>
      {body}
      <details data-help>
        <summary>{t.helpSummary}</summary>
        {t.helpBody.map((line) => <p key={line}>{line}</p>)}
      </details>
    </section>
  );
}

export function Composition({ documentId, extras }: { documentId: string; extras: ReviewExtras }) {
  const [read, retry] = useRead(() => extras.composition(documentId), `composition:${documentId}`);
  return <CompositionView read={read} onRetry={retry} />;
}

// ---- PG-7 ----

const NOTE_COLUMNS: readonly DataTableColumn<NoteRow>[] = [
  { id: "head", header: t.notesCaption, cell: (row) => row.head },
  { id: "text", header: t.colWhat, cell: (row) => row.text },
];

export function NotesView({ read, onRetry }: { read: DisputeListOutcome | null; onRetry: () => void }) {
  let body: ReactNode;
  if (read === null) body = <p className="meta" role="status">{t.notesLoading}</p>;
  else if (read.kind === "forbidden") body = <p className="note">{t.notesForbidden}</p>;
  else if (read.kind === "signedOut") body = null;
  else if (read.kind === "unavailable") body = <><p className="note" role="alert">{t.notesUnavailable}</p><Retry onRetry={onRetry} /></>;
  else if (read.kind !== "ok") body = null;
  else if (read.disputes.length === 0) body = <p className="note">{t.notesNone}</p>;
  else body = (
    <>
      <p>{t.notesCount(read.disputes.length)}</p>
      <DataTable caption={t.notesCaption} columns={NOTE_COLUMNS} rows={noteRows(read.disputes)} rowKey={(row) => row.key} empty={t.notesNone} />
    </>
  );
  return (
    <section aria-labelledby="pg7-h" data-nf5="PG-7" data-state={read === null ? "loading" : read.kind}>
      <h3 id="pg7-h">{t.notesHeading}</h3>
      <p className="note">{t.notesIntro}</p>
      {body}
      <p className="note" data-missing="finding-explanation">{t.notesFinding}</p>
      <p className="meta">{t.notesFindingReason}</p>
    </section>
  );
}

export function Notes({ documentId, extras }: { documentId: string; extras: ReviewExtras }) {
  const [read, retry] = useRead(() => extras.disputes(documentId), `notes:${documentId}`);
  return <NotesView read={read} onRetry={retry} />;
}

// ---- PG-5 ----

const PLACE_COLUMNS = (jumpHref: string): readonly DataTableColumn<Place>[] => [
  { id: "when", header: t.colWhen, cell: (row) => row.when },
  { id: "what", header: t.colWhat, cell: (row) => row.what },
  { id: "jump", header: t.colJump, cell: () => <a href={jumpHref} data-jump>{t.placesJump}</a> },
];

/** „Važna mjesta”: no automatic playback, no live region; the jump opens the replay (no session in the record yet, D-239). */
export function Places({ documentId, reads, replayHref }: { documentId: string; reads: ReviewReads; replayHref: string }) {
  const [summary, retrySummary] = useRead(() => reads.summary(documentId), `pg5s:${documentId}`);
  const [details] = useRead(() => reads.details(documentId), `pg5d:${documentId}`);
  let body: ReactNode;
  if (summary === null) body = <p className="meta" role="status">{t.notesLoading}</p>;
  else if (summary.kind === "notFound") body = <p className="note">{t.placesNotGiven}</p>;
  else if (summary.kind === "signedOut") body = null;
  else if (summary.kind === "unavailable") body = <><p className="note" role="alert">{t.placesError}</p><Retry onRetry={retrySummary} /></>;
  else if (summary.kind === "ok") {
    const rows = importantPlaces(summary.value, details?.kind === "ok" ? details.value : null);
    body = rows.length === 0 ? <p className="note">{t.placesNone}</p>
      : <DataTable caption={t.placesCaption} columns={PLACE_COLUMNS(replayHref)} rows={rows} rowKey={(row) => row.key} empty={t.placesNone} />;
  } else body = null;
  return (
    <section aria-labelledby="pg5-h" data-nf5="PG-5" data-state={summary === null ? "loading" : summary.kind}>
      <h3 id="pg5-h">{t.placesHeading}</h3>
      <p className="note">{t.placesIntro}</p>
      {body}
      <p className="meta">{t.placesJumpNote}</p>
      <p className="meta">{t.placesKeys}</p>
    </section>
  );
}

// ---- PG-9 ----

const GIVEN_COLUMNS: readonly DataTableColumn<GivenRow>[] = [
  { id: "when", header: t.colGivenWhen, cell: (row) => row.when },
  { id: "who", header: t.colGivenWhat, cell: (row) => <><b>{row.who}</b>{": "}{row.what}</> },
  { id: "state", header: t.colGivenState, cell: (row) => (row.state === "draft" ? t.givenDraft : t.givenPublished) },
];

export function GivenView({ comments, drafts, onRetry }: { comments: ListOutcome | null; drafts: DraftsRead | null; onRetry: () => void }) {
  let body: ReactNode;
  if (comments === null || drafts === null) body = <p className="meta" role="status">{t.givenLoading}</p>;
  else if (comments.kind === "signedOut" || drafts.kind === "signedOut") body = null;
  else if (comments.kind !== "ok") body = <><p className="note" role="alert">{t.givenUnavailable}</p><Retry onRetry={onRetry} /></>;
  else {
    // A failed draft read leaves the published comments in place and says so.
    const rows = givenRows(comments.threads, drafts.kind === "ready" ? drafts.drafts : []);
    body = (
      <>
        {drafts.kind === "unavailable" && <p className="note" role="alert">{t.givenUnavailable}</p>}
        {rows.length === 0 ? <p className="note">{t.givenNone}</p>
          : <DataTable caption={t.givenCaption} columns={GIVEN_COLUMNS} rows={rows} rowKey={(row) => row.key} empty={t.givenNone} />}
      </>
    );
  }
  return (
    <section aria-labelledby="pg9-h" data-nf5="PG-9" data-state={comments === null ? "loading" : comments.kind}>
      <h3 id="pg9-h">{t.givenHeading}</h3>
      <p className="note">{t.givenIntro}</p>
      {body}
      <p className="meta" data-missing="seen">{t.givenSeen}</p>
      <p className="meta">{t.givenOther}</p>
    </section>
  );
}

export function Given({ documentId, extras }: { documentId: string; extras: ReviewExtras }) {
  const [comments, retryComments] = useRead(() => extras.comments(documentId), `pg9c:${documentId}`);
  const [drafts, retryDrafts] = useRead(() => extras.drafts(documentId), `pg9d:${documentId}`);
  return <GivenView comments={comments} drafts={drafts} onRetry={() => { retryComments(); retryDrafts(); }} />;
}
