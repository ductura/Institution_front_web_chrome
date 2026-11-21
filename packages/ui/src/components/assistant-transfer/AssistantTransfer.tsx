"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { InertButton } from "../assistant-states/InertButton";
import styles from "./AssistantTransfer.module.css";
import { changedSpan } from "./transfer-logic";

export type AssistantTransferLabels = {
  /** The action on an answer, „Prenesi u rad”. */
  transfer: string;
  /** Heading of the comparison. */
  compare: string;
  /** Says how the changed part is marked. */
  compareHint: string;
  before: string;
  after: string;
  apply: string;
  cancel: string;
  /** Shown once the parent has applied the answer. */
  transferred: string;
  /** Shown while the parent is applying. */
  busy: string;
  /** Why the action is not available, shown when `disabled`. */
  disabled: string;
};

export type AssistantTransferProps = {
  labels: AssistantTransferLabels;
  /** The target paragraph as it is now. */
  paragraph: string;
  /** The assistant's answer that would replace it. */
  answer: string;
  /** The student chose to apply; the component writes nothing itself. */
  onApply: () => void;
  /** The student closed the comparison without applying. */
  onCancel?: () => void;
  transferred?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** A failure reported by the parent, shown as an alert. */
  error?: string;
};

/**
 * „Prenesi u rad” on an assistant answer (s16, assist2): the button opens a comparison of the
 * paragraph before and after, with the changed stretch marked, and reports the decision through
 * callbacks. Closing the comparison returns focus to the button.
 */
export function AssistantTransfer({ labels, paragraph, answer, onApply, onCancel, transferred = false, busy = false, disabled = false, error }: AssistantTransferProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const wasOpen = useRef(false);
  const id = useId();
  const titleId = `${id}-title`;
  const metaId = `${id}-meta`;
  const hintId = `${id}-hint`;

  useEffect(() => {
    if (open) title.current?.focus();
    else if (wasOpen.current) anchor.current?.querySelector("button")?.focus();
    wasOpen.current = open;
  }, [open]);

  const unavailable = disabled || busy || transferred;
  const close = (apply: boolean) => {
    if (apply && unavailable) return;
    setOpen(false);
    if (apply) onApply();
    else onCancel?.();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close(false);
  };

  const span = changedSpan(paragraph, answer);
  const meta = busy ? labels.busy : transferred ? labels.transferred : disabled ? labels.disabled : "";

  return (
    <div className={styles.transfer}>
      {error === undefined ? null : (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}
      <span ref={anchor}>
        <InertButton tone="quiet" inert={unavailable || open} busy={busy} describedBy={meta === "" ? undefined : metaId} onClick={() => setOpen(true)}>
          {labels.transfer}
        </InertButton>
      </span>
      <p id={metaId} className={styles.meta} role="status">
        {meta}
      </p>
      {open ? (
        <section className={styles.compare} aria-labelledby={titleId} aria-describedby={hintId} onKeyDown={onKeyDown}>
          <h3 id={titleId} ref={title} className={styles.title} tabIndex={-1}>
            {labels.compare}
          </h3>
          <p id={hintId} className={styles.meta}>
            {labels.compareHint}
          </p>
          <figure className={styles.side}>
            <figcaption className={styles.label}>{labels.before}</figcaption>
            <p className={styles.text} data-side="before">
              {span.prefix}
              {span.removed === "" ? null : <del className={styles.removed}>{span.removed}</del>}
              {span.suffix}
            </p>
          </figure>
          <figure className={styles.side}>
            <figcaption className={styles.label}>{labels.after}</figcaption>
            <p className={styles.text} data-side="after">
              {span.prefix}
              {span.added === "" ? null : <ins className={styles.added}>{span.added}</ins>}
              {span.suffix}
            </p>
          </figure>
          <div className={styles.actions}>
            <InertButton inert={unavailable} busy={busy} describedBy={meta === "" ? undefined : metaId} onClick={() => close(true)}>
              {labels.apply}
            </InertButton>
            <InertButton tone="quiet" onClick={() => close(false)}>
              {labels.cancel}
            </InertButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
