"use client";

import { useEffect, useId, useRef, type FormEvent } from "react";

import { Button } from "../Button";
import { TextArea } from "../TextArea";
import styles from "./AssistantThread.module.css";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type PersonalDataKind = "email" | "longNumber" | "phone";

export type AssistantThreadLabels = {
  conversation: string;
  user: string;
  assistant: string;
  empty: string;
  prompt: string;
  send: string;
  waiting: string;
  disabled: string;
  warning: {
    title: string;
    description: string;
    kinds: Record<PersonalDataKind, string>;
    removeAndSend: string;
    sendAnyway: string;
    cancel: string;
  };
};

export type AssistantThreadProps = {
  labels: AssistantThreadLabels;
  messages: readonly AssistantMessage[];
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (text: string) => void;
  waiting?: boolean;
  disabled?: boolean;
  error?: string;
  /** The caller reviews the draft and handles redaction before sending. */
  privacyWarning?: {
    kinds: readonly PersonalDataKind[];
    onRemoveAndSend: () => void;
    onSendAnyway: () => void;
    onCancel: () => void;
  };
};

export function AssistantThread({
  labels, messages, draft, onDraftChange, onSend, waiting, disabled, error, privacyWarning,
}: AssistantThreadProps) {
  const warningId = useId();
  const warningTitle = useRef<HTMLParagraphElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const warning = waiting || disabled ? undefined : privacyWarning;
  const reviewing = Boolean(warning);
  const text = draft.trim();
  const canSend = text.length > 0 && !waiting && !disabled && !reviewing;

  useEffect(() => {
    if (reviewing) warningTitle.current?.focus();
  }, [reviewing]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSend(text);
  }

  function review(action: () => void) {
    field.current?.focus();
    action();
  }

  return (
    <div className={styles.thread}>
      <div role="log" aria-label={labels.conversation}>
        {messages.length === 0 ? <p className={styles.note}>{labels.empty}</p> : (
          <ol className={styles.messages} role="list">
            {messages.map(({ id, role, text }) => (
              <li key={id} className={styles.message} data-role={role}>
                <strong>{role === "user" ? labels.user : labels.assistant}</strong>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div role="status" className={styles.status}>{waiting && labels.waiting}</div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <form className={styles.form} onSubmit={submit}>
        <TextArea ref={field} label={labels.prompt} rows={3} value={draft} busy={waiting}
          disabled={disabled} readOnly={reviewing} onChange={(event) => onDraftChange(event.target.value)} />
        {warning ? (
          <div className={styles.warning} role="group" aria-labelledby={warningId}>
            <p id={warningId} ref={warningTitle} tabIndex={-1}><strong>{labels.warning.title}</strong></p>
            <p>{labels.warning.description}</p>
            <ul>
              {warning.kinds.map((kind) => <li key={kind}>{labels.warning.kinds[kind]}</li>)}
            </ul>
            <div className={styles.actions}>
              <Button onClick={() => review(warning.onRemoveAndSend)}>{labels.warning.removeAndSend}</Button>
              <Button tone="quiet" onClick={() => review(warning.onSendAnyway)}>{labels.warning.sendAnyway}</Button>
              <Button tone="quiet" onClick={() => review(warning.onCancel)}>{labels.warning.cancel}</Button>
            </div>
          </div>
        ) : (
          <Button type="submit" busy={waiting} disabled={disabled || (!waiting && !canSend)}>{labels.send}</Button>
        )}
        {disabled && <p className={styles.note}>{labels.disabled}</p>}
      </form>
    </div>
  );
}
