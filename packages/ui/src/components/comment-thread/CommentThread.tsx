"use client";

import { useId, useState, type KeyboardEvent } from "react";

import styles from "./CommentThread.module.css";
import { replyKeyAction, replyText, visibleEntries, type CommentThreadData } from "./thread-logic";

export type CommentThreadLabels = {
  /** Accessible name of the thread; the page adds the anchor or "Opći komentar". */
  thread: string;
  reply: string;
  replyField: string;
  send: string;
  resolve: string;
  reopen: string;
  resolved: string;
  open: string;
  /** "Prikaži sve odgovore (n)" and "Sažmi" for a resolved thread. */
  showAll: (count: number) => string;
  collapse: string;
};

export type CommentThreadProps = {
  thread: CommentThreadData;
  labels: CommentThreadLabels;
  onReply: (text: string) => void;
  onResolve: () => void;
  onReopen: () => void;
  /** No reply and no resolve (a submitted work, someone else's role). */
  readOnly?: boolean;
};

/**
 * A comment thread: entries, replies, resolved state (collapsed to the first entry), keyboard and aria.
 * The page owns the records; the thread only reports what the person asked for.
 */
export function CommentThread({ thread, labels, onReply, onResolve, onReopen, readOnly = false }: CommentThreadProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const fieldId = useId();
  const entries = visibleEntries(thread, expanded);
  const hidden = thread.entries.length - entries.length;

  const send = () => {
    const text = replyText(draft);
    if (text === null) return;
    onReply(text);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = replyKeyAction(event.key, event.ctrlKey, event.metaKey);
    if (action === null) return;
    event.preventDefault();
    if (action === "send") send();
    else setDraft("");
  };

  return (
    <article className={styles.thread} aria-label={labels.thread} data-resolved={thread.resolved ? "true" : "false"}>
      <header className={styles.head}>
        <span className={styles.state}>{thread.resolved ? labels.resolved : labels.open}</span>
        {!readOnly && (
          <button type="button" className={styles.button} onClick={thread.resolved ? onReopen : onResolve}>
            {thread.resolved ? labels.reopen : labels.resolve}
          </button>
        )}
      </header>
      {thread.anchor ? <blockquote className={styles.anchor}>{thread.anchor}</blockquote> : null}
      <ol className={styles.entries}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.entry} data-mentor={entry.mentor ? "true" : undefined}>
            <p className={styles.meta}><strong>{entry.author}</strong> <time>{entry.at}</time></p>
            <p className={styles.text}>{entry.text}</p>
          </li>
        ))}
      </ol>
      {thread.resolved && (hidden > 0 || expanded) && thread.entries.length > 1 && (
        <button type="button" className={styles.link} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? labels.collapse : labels.showAll(thread.entries.length)}
        </button>
      )}
      {!readOnly && !thread.resolved && (
        <div className={styles.reply}>
          <label htmlFor={fieldId} className={styles.label}>{labels.replyField}</label>
          <textarea id={fieldId} className={styles.field} rows={2} value={draft} placeholder={labels.reply}
            onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} />
          <button type="button" className={styles.button} disabled={replyText(draft) === null} onClick={send}>{labels.send}</button>
        </div>
      )}
    </article>
  );
}
