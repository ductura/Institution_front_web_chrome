"use client";

/**
 * Comments next to a paragraph from the teacher's live view (DAN-86 step 2c;
 * route and RPCs: B-10, BACKEND 4.11; design pregled-radova-v2 "Novi
 * komentar"). The teacher marks text in the live document and writes a
 * comment; the anchor is made from the text the teacher sees, never from a
 * newer one (attack 8). Each thread is placed again against every new state
 * of the text; a place that cannot be found reliably stays in the list with
 * a note, never at a guessed place (attack 7). Text is React text, never
 * HTML (attack 10). The list is the same `list_comments` the student reads
 * (PRODUCT §5 rule 5).
 */

import { Button, Dialog, TextArea, replyKeyAction } from "@ductura/ui";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  changeThreadState, createComment, listComments, replyComment,
  type CommentThread, type CreateOutcome, type ListOutcome, type ReplyOutcome,
} from "@/client/comments";
import { limitBody, type TextAnchor } from "@/domain/collaboration";
import { formatDateTimeHr } from "@/lib/i18n/hr";
import { messagesHr } from "@/lib/i18n/messages.hr";

import type { TextRange } from "./comment-place";
import { consultationEntries, consultationText, printConsultation } from "./comments/consultation";
import printStyles from "./comments/consultation.module.css";
import { consultationHr as tp } from "./comments/messages.hr";
import styles from "./LiveWorkView.module.css";

const t = messagesHr.comments;
const tt = messagesHr.teacherComments;

/** `pending`: no text shown yet, so the place is not looked for and not called lost. */
export type PlacedThread = { thread: CommentThread; range: TextRange | null; pending: boolean };

function ThreadCard({ placed, current, readOnly, onChanged, onShow }: {
  placed: PlacedThread; current: () => boolean; readOnly: boolean;
  onChanged: () => void; onShow: (range: TextRange) => void;
}) {
  const { thread, range, pending } = placed;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<ReplyOutcome, "ok"> | null>(null);
  const [first, ...replies] = thread.comments;

  const act = async (run: () => Promise<ReplyOutcome>) => {
    if (busy || readOnly) return;
    setBusy(true);
    const outcome = await run();
    setBusy(false);
    if (outcome !== "ok") return setError(outcome);
    setDraft("");
    setError(null);
    onChanged();
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim() !== "") void act(() => replyComment(thread.id, draft, current));
  };

  return (
    <article className={styles.thread} aria-label={t.number.replace("{n}", String(thread.number))}>
      <header className={styles.threadHead}>
        <span>{thread.number}</span>
        <span>{t.state[thread.state]}</span>
      </header>
      {thread.anchor ? <p className={styles.quote}>„{thread.anchor.quote}”</p> : null}
      {range || pending ? null : <p className={styles.muted}>{t.notPlaced}</p>}
      {first ? <p>{first.body}</p> : null}
      {first ? <p className={styles.muted}>{formatDateTimeHr(first.createdWindow)}</p> : null}
      {replies.map((reply) => (
        <p key={reply.id} className={styles.reply}>
          <span className={styles.muted}>{reply.isOwn ? t.own : reply.role === "teacher" ? t.teacher : t.student}</span>{" "}
          {reply.body}
        </p>
      ))}
      <div className={styles.actions}>
        {range && <Button tone="quiet" onClick={() => onShow(range)}>{t.showInText}</Button>}
        {!readOnly && (thread.state === "resolved" ? (
          <Button tone="quiet" busy={busy}
            onClick={() => void act(() => changeThreadState(thread.id, "reopen", current))}>{tt.reopen}</Button>
        ) : (
          <Button tone="quiet" busy={busy}
            onClick={() => void act(() => changeThreadState(thread.id, "resolve", current))}>{tt.resolve}</Button>
        ))}
      </div>
      {!readOnly && thread.state !== "resolved" && (
        <form className={styles.form} onSubmit={send}>
          <TextArea rows={2} label={t.replyLabel} placeholder={t.replyPlaceholder} busy={busy}
            value={draft} onChange={(event) => setDraft(limitBody(event.target.value))}
            onKeyDown={(event) => {
              if (busy || event.nativeEvent.isComposing) return;
              const action = replyKeyAction(event.key, event.ctrlKey, event.metaKey);
              if (action === null) return;
              event.preventDefault();
              if (action === "cancel") setDraft("");
              else if (draft.trim() !== "") void act(() => replyComment(thread.id, draft, current));
            }} />
          <Button type="submit" busy={busy} disabled={draft.trim() === ""}>{busy ? t.replying : t.reply}</Button>
        </form>
      )}
      {error ? <p role="alert" className={styles.error}>{t.replyErrors[error]}</p> : null}
    </article>
  );
}

/** The new comment on a marked passage; `anchor` comes from the text on screen. */
function NewComment({ documentId, anchor, current, onDone }: {
  documentId: string; anchor: TextAnchor; current: () => boolean; onDone: (created: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<CreateOutcome, "ok"> | null>(null);
  const titleId = useId();
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || body.trim() === "") return;
    setBusy(true);
    const outcome = await createComment(documentId, body, anchor, current);
    setBusy(false);
    if (outcome === "ok") return onDone(true);
    setError(outcome);
  };
  return (
    <form className={styles.newComment} onSubmit={(event) => void publish(event)} aria-labelledby={titleId}>
      <h3 id={titleId}>{tt.newTitle}</h3>
      <p className={styles.quote}>„{anchor.quote}”</p>
      <TextArea rows={3} label={tt.bodyLabel} value={body} busy={busy}
        onChange={(event) => setBody(limitBody(event.target.value))} />
      <div className={styles.actions}>
        <Button type="submit" busy={busy} disabled={body.trim() === ""}>{busy ? tt.publishing : tt.publish}</Button>
        <Button tone="quiet" disabled={busy} onClick={() => onDone(false)}>{tt.cancel}</Button>
      </div>
      {error ? <p role="alert" className={styles.error}>{tt.errors[error]}</p> : null}
    </form>
  );
}

export function useComments(documentId: string, current: () => boolean, active: boolean) {
  const [outcome, setOutcome] = useState<ListOutcome | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!active || !current()) return;
    const mine = ++generation.current;
    const result = await listComments(documentId, current);
    if (mine === generation.current) setOutcome(result);
  }, [documentId, current, active]);
  // Dropped in the render that first sees `active` change (D-118).
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    setOutcome(null);
  }
  useEffect(() => {
    if (active) void load();
    else generation.current += 1;
  }, [load, active]);
  // An answer that lands between that render and the effect is never shown.
  return { outcome: active ? outcome : null, load };
}

function ConsultationPrint({ placed, nodeOrder, current }: {
  placed: readonly PlacedThread[];
  nodeOrder: readonly { id: string }[];
  current: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const entries = open ? consultationEntries(placed, nodeOrder) : [];
  const copy = async () => {
    if (!current()) return;
    setError(undefined);
    setStatus("");
    try {
      await navigator.clipboard.writeText(consultationText(entries));
      setStatus(tp.copied);
    } catch {
      setError(tp.copyError);
    }
  };
  const print = () => {
    if (!current()) return;
    setStatus("");
    const frame = frameRef.current;
    setError(frame && printConsultation(frame, entries) ? undefined : tp.printError);
  };
  return (
    <>
      <Button tone="quiet" onClick={() => {
        if (!current()) return;
        setError(undefined);
        setStatus("");
        setOpen(true);
      }}>{tp.title}</Button>
      <Dialog open={open} title={tp.title} error={error} onClose={() => setOpen(false)} actions={
        <>
          <Button tone="quiet" disabled={entries.length === 0} onClick={() => void copy()}>{tp.copy}</Button>
          <Button tone="quiet" disabled={entries.length === 0} onClick={print}>{tp.print}</Button>
          <Button onClick={() => setOpen(false)}>{tp.close}</Button>
        </>
      }>
        {entries.length === 0 ? <p>{tp.empty}</p> : (
          <ol>
            {entries.map((entry) => (
              <li key={entry.id} className={printStyles.entry}>
                <strong>{entry.label}</strong>
                <blockquote>{entry.quote}</blockquote>
                {entry.messages.map(({ id, text }) => <p key={id}>{text}</p>)}
              </li>
            ))}
          </ol>
        )}
        <p role="status" hidden={!status}>{status}</p>
        <iframe ref={frameRef} className={printStyles.frame} tabIndex={-1} aria-hidden="true" title={tp.title} />
      </Dialog>
    </>
  );
}

export default function TeacherComments({
  documentId, outcome, placed, nodeOrder, draft, current, readOnly = false, onReload, onDraftDone, onShow,
}: {
  documentId: string;
  outcome: ListOutcome | null;
  placed: PlacedThread[];
  nodeOrder: readonly { id: string }[];
  draft: TextAnchor | null;
  current: () => boolean;
  readOnly?: boolean;
  onReload: () => void;
  onDraftDone: () => void;
  onShow: (range: TextRange) => void;
}) {
  let list;
  if (outcome === null) list = <p className={styles.muted}>{t.loading}</p>;
  else if (outcome.kind === "forbidden") list = <p className={styles.muted}>{t.notAvailable}</p>;
  else if (outcome.kind !== "ok") list = <p className={styles.muted} role="status">{t[outcome.kind]}</p>;
  else if (placed.length === 0) list = <p className={styles.muted}>{tt.empty}</p>;
  else list = placed.map((p) => (
    <ThreadCard key={p.thread.id} placed={p} current={current} readOnly={readOnly} onChanged={onReload} onShow={onShow} />
  ));

  const titleId = useId();
  return (
    <section className={styles.comments} aria-labelledby={titleId}>
      <h2 id={titleId}>{t.title}</h2>
      {!readOnly && outcome?.kind === "ok" && (draft ? (
        <NewComment key={`${documentId}:${draft.nodeId}:${draft.startHint}:${draft.endHint}:${draft.quote}`}
          documentId={documentId} anchor={draft} current={current}
          onDone={(created) => { onDraftDone(); if (created) onReload(); }} />
      ) : <p className={styles.muted}>{tt.hint}</p>)}
      {list}
      <p className={styles.muted}>{t.note}</p>
      <div className={styles.actions}>
        <Button tone="quiet" onClick={onReload}>{t.refresh}</Button>
        {outcome?.kind === "ok" && (
          <ConsultationPrint key={documentId} placed={placed} nodeOrder={nodeOrder} current={current} />
        )}
      </div>
    </section>
  );
}
