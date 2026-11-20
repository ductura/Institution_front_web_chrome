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
  scope?: {
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  replacement?: {
    value: string;
    label: string;
    placeholder: string;
    maxLength?: number;
    replace: string;
    all: string;
    disabled?: boolean;
    allDisabled?: boolean;
    onChange: (value: string) => void;
    onReplace: () => void;
    onReplaceAll: () => void;
  };
  message?: string;
};

/**
 * The find bar (UI-6C, prototype #find): field, next / previous, the number of hits and Esc.
 * The page owns the document: it searches, moves the hit and shows it; the bar only asks.
 * Enter = next, Shift+Enter = previous (in the field), Escape = close (anywhere in the bar).
 */
export function FindBar({ query, onQueryChange, current, total, onNext, onPrevious, onClose, labels,
  autoFocus = true, scope, replacement, message }: FindBarProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.select();
  }, [autoFocus]);

  const status = findStatus(query, current, total);
  const text = status.kind === "hit" ? labels.count(status.position, status.total) : status.kind === "none" ? labels.none : "";

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const action = findKeyAction(event.key, event.shiftKey);
    // Enter on a button is that button's own activation; only the field turns it into a step.
    if (action === null || (action !== "close" && event.target !== input.current)) return;
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
      {replacement ? <input type="text" className={styles.input} aria-label={replacement.label}
        placeholder={replacement.placeholder} maxLength={replacement.maxLength} value={replacement.value}
        onChange={(event) => replacement.onChange(event.target.value)} /> : null}
      {scope ? <select className={styles.scope} aria-label={scope.label} value={scope.value}
        onChange={(event) => scope.onChange(event.target.value)}>
        {scope.options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select> : null}
      <button type="button" className={styles.button} onClick={onPrevious} disabled={total <= 0} aria-label={labels.previous} title={labels.previous}>↑</button>
      <button type="button" className={styles.button} onClick={onNext} disabled={total <= 0} aria-label={labels.next} title={labels.next}>↓</button>
      {replacement ? <>
        <button type="button" className={styles.action} onClick={replacement.onReplace} disabled={replacement.disabled}>{replacement.replace}</button>
        <button type="button" className={styles.action} onClick={replacement.onReplaceAll}
          disabled={replacement.disabled || replacement.allDisabled}>{replacement.all}</button>
      </> : null}
      <span className={styles.count} role="status" aria-live="polite">{text}</span>
      {message !== undefined ? <span className={styles.message} role="status">{message}</span> : null}
      <span className={styles.grow} />
      <button type="button" className={styles.button} onClick={onClose} aria-label={labels.close} title={labels.close}>✕</button>
    </div>
  );
}
