"use client";

import { useRef, useState } from "react";

import { Button } from "../Button";
import { Dialog } from "../Dialog";
import { Tag } from "../Tag";
import { TextArea } from "../TextArea";
import { codePointCount, counterText } from "./dispute-logic";
import styles from "./EventDispute.module.css";

export type EventDisputeKind = "supplement" | "dispute";

export type EventDisputeMark = { readonly id: string; readonly kind: EventDisputeKind; readonly text: string };

/** What a send can answer; the dialog maps each to its message. */
export type EventDisputeResult = "ok" | "forbidden" | "invalid" | "signedOut" | "unavailable";

export type EventDisputeLabels = {
  supplementAction: string;
  disputeAction: string;
  supplementTitle: string;
  disputeTitle: string;
  supplementMark: string;
  disputeMark: string;
  /** Text field label. */
  field: string;
  hint: string;
  /** "{used} od {max} znakova". */
  counter: string;
  send: string;
  sending: string;
  cancel: string;
  /** Under the marks heading, for the list's accessible name. */
  marksLabel: string;
  sent: string;
  empty: string;
  tooLong: string;
  invalid: string;
  forbidden: string;
  signedOut: string;
  unavailable: string;
};

export type EventDisputeProps = {
  labels: EventDisputeLabels;
  /** Existing supplements and disputes of this event, shown under it as marks. */
  marks: readonly EventDisputeMark[];
  /** false for the teacher: marks only, no actions. */
  canAct: boolean;
  max: number;
  onSubmit: (kind: EventDisputeKind, text: string) => Promise<EventDisputeResult>;
};

/**
 * The marks and the two actions under one event of the process summary (WEB-1305, M7.8). The event's
 * own description is not touched. The dialog counts the characters of the one text, with no sum
 * and no score; Escape closes it and the focus goes back to the action that opened it.
 */
export function EventDispute({ labels, marks, canAct, max, onSubmit }: EventDisputeProps) {
  const [open, setOpen] = useState<EventDisputeKind | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const used = codePointCount(text);
  const tooLong = used > max;
  const close = () => {
    if (busy) return;
    setOpen(null);
    setText("");
    setError(undefined);
  };
  const messages: Record<Exclude<EventDisputeResult, "ok">, string> = {
    forbidden: labels.forbidden, invalid: labels.invalid, signedOut: labels.signedOut, unavailable: labels.unavailable,
  };
  const send = async () => {
    if (open === null || busy) return;
    if (text.trim().length === 0) return setError(labels.invalid);
    if (tooLong) return setError(labels.tooLong);
    setBusy(true);
    setError(undefined);
    const result = await onSubmit(open, text);
    setBusy(false);
    if (result === "ok") {
      setOpen(null);
      setText("");
      setSent(true);
    } else setError(messages[result]);
  };

  return (
    <div className={styles.root}>
      {marks.length > 0 ? (
        <ul className={styles.marks} aria-label={labels.marksLabel}>
          {marks.map((mark) => (
            <li key={mark.id} className={styles.mark}>
              <span><Tag tone={mark.kind === "dispute" ? "warn" : "neutral"}>{mark.kind === "dispute" ? labels.disputeMark : labels.supplementMark}</Tag></span>
              <p className={styles.markText}>{mark.text}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {canAct ? (
        <div className={styles.actions}>
          <Button tone="quiet" onClick={() => { setSent(false); setOpen("supplement"); }}>{labels.supplementAction}</Button>
          <Button tone="quiet" onClick={() => { setSent(false); setOpen("dispute"); }}>{labels.disputeAction}</Button>
        </div>
      ) : null}
      <p role="status" className={styles.status}>{sent ? labels.sent : ""}</p>
      <Dialog open={open !== null} title={open === "dispute" ? labels.disputeTitle : labels.supplementTitle}
        onClose={close} dismissible={!busy} initialFocus={fieldRef} error={error}
        actions={(
          <>
            <Button tone="quiet" onClick={close}>{labels.cancel}</Button>
            <Button busy={busy} onClick={() => { void send(); }}>{busy ? labels.sending : labels.send}</Button>
          </>
        )}>
        <TextArea ref={fieldRef} label={labels.field} hint={labels.hint} value={text} busy={busy}
          onChange={(event) => setText(event.target.value)} />
        <p className={styles.counter} data-over={tooLong ? "" : undefined}>{counterText(labels.counter, used, max)}</p>
      </Dialog>
    </div>
  );
}
