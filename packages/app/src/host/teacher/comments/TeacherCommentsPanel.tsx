import { Button, Dialog, TextArea, replyKeyAction } from "@ductura/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  changeThreadState, createComment, replyComment,
  type CreateOutcome, type ListOutcome, type ReplyOutcome,
} from "@/client/comments";
import { limitBody, type TextAnchor } from "@/domain/collaboration";
import { messagesHr } from "@/lib/i18n/messages.hr";
import type { TextRange } from "@/components/teacher/comment-place";
import { consultationEntries, consultationText, printConsultation } from "@/components/teacher/comments/consultation";
import printStyles from "@/components/teacher/comments/consultation.module.css";
import { consultationHr as tp } from "@/components/teacher/comments/messages.hr";
import type { PlacedThread } from "@/components/teacher/TeacherComments";
import styles from "@/components/teacher/LiveWorkView.module.css";

import { COMMENT_TOAST_MS, teacherCommentsMessages as t } from "./messages.hr";
import { entryWho, threadTitle } from "./model";

const c = messagesHr.comments;
const tt = messagesHr.teacherComments;

function ThreadCard({ placed, current, readOnly, onChanged, onShow, onToast }: {
  placed: PlacedThread; current: () => boolean; readOnly: boolean;
  onChanged: () => void; onShow: (range: TextRange) => void; onToast: (text: string) => void;
}) {
  const { thread, range, pending } = placed;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<ReplyOutcome, "ok"> | null>(null);

  // The toast is shown only once the server has confirmed (WEB-2164).
  const act = async (run: () => Promise<ReplyOutcome>, toast: boolean) => {
    if (busy || readOnly) return;
    setBusy(true);
    const outcome = await run();
    setBusy(false);
    if (outcome !== "ok") return setError(outcome);
    setDraft("");
    setError(null);
    if (toast) onToast(t.added);
    onChanged();
  };
  const send = () => {
    if (draft.trim() !== "") void act(() => replyComment(thread.id, draft, current), true);
  };

  return (
    <article className={styles.thread} aria-label={c.number.replace("{n}", String(thread.number))}>
      <header className={styles.threadHead}>
        <b>{threadTitle(thread.anchor?.quote ?? null)}</b>
        <span>{c.state[thread.state]}</span>
      </header>
      {range || pending ? null : <p className={styles.muted}>{c.notPlaced}</p>}
      {thread.comments.map((entry) => (
        <p key={entry.id} className={styles.reply}>
          <span className={styles.muted}>{entryWho(entry)}</span>{" "}
          {entry.body}
        </p>
      ))}
      <div className={styles.actions}>
        {range && <Button tone="quiet" onClick={() => onShow(range)}>{c.showInText}</Button>}
        {!readOnly && (thread.state === "resolved" ? (
          <Button tone="quiet" busy={busy}
            onClick={() => void act(() => changeThreadState(thread.id, "reopen", current), false)}>{t.reopen}</Button>
        ) : (
          <Button tone="quiet" busy={busy}
            onClick={() => void act(() => changeThreadState(thread.id, "resolve", current), false)}>{t.resolve}</Button>
        ))}
      </div>
      {!readOnly && thread.state !== "resolved" && (
        <form className={styles.form} onSubmit={(event: FormEvent) => { event.preventDefault(); send(); }}>
          <TextArea rows={2} label={t.replyLabel} placeholder={t.replyPlaceholder} busy={busy}
            value={draft} onChange={(event) => setDraft(limitBody(event.target.value))}
            onKeyDown={(event) => {
              if (busy || event.nativeEvent.isComposing) return;
              const action = replyKeyAction(event.key, event.ctrlKey, event.metaKey);
              if (action === null) return;
              event.preventDefault();
              if (action === "cancel") setDraft("");
              else send();
            }} />
          <Button type="submit" busy={busy} disabled={draft.trim() === ""}>{busy ? t.replying : t.reply}</Button>
        </form>
      )}
      {error ? <p role="alert" className={styles.error}>{c.replyErrors[error]}</p> : null}
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
      <h3 id={titleId}>{t.newTitle}</h3>
      <p className={styles.quote}>„{anchor.quote}”</p>
      <TextArea rows={3} label={t.newLabel} value={body} busy={busy}
        onChange={(event) => setBody(limitBody(event.target.value))} />
      <div className={styles.actions}>
        <Button type="submit" busy={busy} disabled={body.trim() === ""}>{busy ? t.newSubmitting : t.newSubmit}</Button>
        <Button tone="quiet" disabled={busy} onClick={() => onDone(false)}>{t.cancel}</Button>
      </div>
      {error ? <p role="alert" className={styles.error}>{tt.errors[error]}</p> : null}
    </form>
  );
}

function ConsultationPrint({ placed, nodeOrder, current }: {
  placed: readonly PlacedThread[]; nodeOrder: readonly { id: string }[]; current: () => boolean;
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

/**
 * The teacher's comments panel with the prototype's texts and behaviour (WEB-2154, N-08).
 * Same data and props as the shared `TeacherComments`; the list comes from the server only.
 */
export default function TeacherCommentsPanel({
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
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), COMMENT_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  let list;
  if (outcome === null) list = <p className={styles.muted}>{c.loading}</p>;
  else if (outcome.kind === "forbidden") list = <p className={styles.muted}>{c.notAvailable}</p>;
  else if (outcome.kind !== "ok") list = <p className={styles.muted} role="status">{c[outcome.kind]}</p>;
  else if (placed.length === 0) list = <p className={styles.muted}>{t.empty}</p>;
  else list = placed.map((p) => (
    <ThreadCard key={p.thread.id} placed={p} current={current} readOnly={readOnly}
      onChanged={onReload} onShow={onShow} onToast={setToast} />
  ));

  const titleId = useId();
  return (
    <section className={styles.comments} aria-labelledby={titleId}>
      <h2 id={titleId}>{t.title}</h2>
      <p className={styles.muted}>{t.note}</p>
      {!readOnly && outcome?.kind === "ok" && (draft ? (
        <NewComment key={`${documentId}:${draft.nodeId}:${draft.startHint}:${draft.endHint}:${draft.quote}`}
          documentId={documentId} anchor={draft} current={current}
          onDone={(created) => { onDraftDone(); if (created) { setToast(t.added); onReload(); } }} />
      ) : <p className={styles.muted}>{t.hint}</p>)}
      {list}
      <p role="status" hidden={!toast}>{toast}</p>
      <div className={styles.actions}>
        <Button tone="quiet" onClick={onReload}>{c.refresh}</Button>
        {outcome?.kind === "ok" && (
          <ConsultationPrint key={documentId} placed={placed} nodeOrder={nodeOrder} current={current} />
        )}
      </div>
    </section>
  );
}
