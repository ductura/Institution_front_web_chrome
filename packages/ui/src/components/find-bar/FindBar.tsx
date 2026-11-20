"use client";

import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";

import styles from "./FindBar.module.css";
import { findKeyAction, findStatus } from "./find-logic";

export type FindBarLabels = {
  /** The bar's own name and the field's label and placeholder ("Traži…"). */
  search: string;
  next: string;
  previous: string;
  close: string;
  /** Shown when the query has no hits ("Nema pojava."). */
  none: string;
  /** "n od N", with n 1-based. */
  count: (position: number, total: number) => string;
};

export type FindBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  /** 0-based index of the hit shown; the page scrolls to it. */
  current: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  labels: FindBarLabels;
  /** The field takes the focus when the bar mounts (Ctrl+F). */
  autoFocus?: boolean;
};

/**
 * The find bar (UI-6C, prototype #find): field, next / previous, the number of hits and Esc.
 * The page owns the document: it searches, moves the hit and shows it; the bar only asks.
 * Enter = next, Shift+Enter = previous, Escape = close.
 */
export function FindBar({ query, onQueryChange, current, total, onNext, onPrevious, onClose, labels, autoFocus = true }: FindBarProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.select();
  }, [autoFocus]);

  const status = findStatus(query, current, total);
  const text = status.kind === "hit" ? labels.count(status.position, status.total) : status.kind === "none" ? labels.none : "";

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const action = findKeyAction(event.key, event.shiftKey);
    if (action === null) return;
    event.preventDefault();
    if (action === "close") onClose();
    else if (action === "next") onNext();
    else onPrevious();
  };

  return (
    <div role="search" aria-label={labels.search} className={styles.bar} onKeyDown={onKeyDown}>
      <input
        ref={input}
        type="search"
        className={styles.input}
        value={query}
        placeholder={labels.search}
        aria-label={labels.search}
        autoComplete="off"
        spellCheck={false}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
      />
      <button type="button" className={styles.button} onClick={onPrevious} disabled={total <= 0} aria-label={labels.previous} title={labels.previous}>↑</button>
      <button type="button" className={styles.button} onClick={onNext} disabled={total <= 0} aria-label={labels.next} title={labels.next}>↓</button>
      <span className={styles.count} role="status" aria-live="polite">{text}</span>
      <span className={styles.grow} />
      <button type="button" className={styles.button} onClick={onClose} aria-label={labels.close} title={labels.close}>✕</button>
    </div>
  );
}
