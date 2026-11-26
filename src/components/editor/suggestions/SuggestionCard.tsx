"use client";

/**
 * One suggestion of a teacher's change as a card of the comments panel (N-08).
 * The student sees "Prihvati" and "Odbij" while it is pending; the teacher sees
 * "Povuci prijedlog" while it is pending. Text is rendered as React text, never
 * as HTML. The card changes nothing itself: the page passes `onDecide`.
 */

import { useState } from "react";


import { editorSuggestionsHr as t } from "./messages.hr";
import styles from "./SuggestionCard.module.css";
import type { ActionOutcome, Decision } from "./suggestion-api";
import type { Suggestion } from "./suggestion";


export type Viewer = "student" | "teacher";
export const decisionsFor = (viewer: Viewer, suggestion: Pick<Suggestion, "state">): readonly Decision[] =>
  suggestion.state !== "pending" ? [] : viewer === "student" ? ["accept", "reject"] : ["withdraw"];

export const hintFor = (viewer: Viewer, state: Suggestion["state"]): string =>
  state === "pending" ? (viewer === "student" ? t.hint.pendingStudent : t.hint.pendingTeacher) : t.hint[state];

export function SuggestionCard({ suggestion, viewer, onDecide, readOnly = false }: {
  suggestion: Suggestion; viewer: Viewer; onDecide: (decision: Decision) => Promise<ActionOutcome>;
  /** The card is only read (a submitted work): the hint stays, no action is offered. */
  readOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionOutcome | null>(null);
  const run = async (decision: Decision) => {
    setBusy(true);
    setError(null);
    const out = await onDecide(decision);
    setBusy(false);
    if (out !== "ok") setError(out);
  };
  const label: Record<Decision, string> = { accept: t.accept, reject: t.reject, withdraw: t.withdraw };
  return (
    <article className={styles.card} data-state={suggestion.state}>
      <div className={styles.head}>
        <b>{t.number.replace("{n}", String(suggestion.number))}</b>
        <span>{t.teacher}</span>
        <span className={styles.state}>{t.state[suggestion.state]}</span>
      </div>
      <p className={styles.change}>
        <del>{suggestion.anchor.quote}</del> <ins>{suggestion.replacement}</ins>
      </p>
      <p className={styles.hint}>{hintFor(viewer, suggestion.state)}</p>
      {error && error !== "ok" ? <p className={styles.error} role="alert">{t.errors[error]}</p> : null}
      <div className={styles.actions}>
        {(readOnly ? [] : decisionsFor(viewer, suggestion)).map((d) => (
          <button key={d} type="button" disabled={busy} onClick={() => void run(d)}>{busy ? t.sending : label[d]}</button>
        ))}
      </div>
    </article>
  );
}
