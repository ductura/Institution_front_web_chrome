"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";

import styles from "./Dialog.module.css";
import { FOCUSABLE, returnTarget, trappedIndex } from "./dialog-focus";

export type DialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  /** The buttons at the bottom; the caller's Buttons. */
  actions?: ReactNode;
  /** Escape, or the caller's own close: the dialog never closes itself. */
  onClose: () => void;
  /** While false (work in progress) Escape does nothing. */
  dismissible?: boolean;
  /** Takes the focus on opening; the first focusable element otherwise. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** An error the dialog shows above its actions (role="alert"). */
  error?: string;
  /** false: shown in the page flow, without the inert backdrop (the catalogue and previews). */
  modal?: boolean;
};

/**
 * The shared dialog (WEB-04, Z-08): a native `<dialog>`. Modal by default, so
 * the page behind is inert; Tab and Shift+Tab wrap inside it, Escape calls
 * `onClose`, and on closing the focus goes back to what opened it.
 */
export function Dialog({
  open, title, children, actions, onClose, dismissible = true, initialFocus, error, modal = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    // Inline (not modal) the dialog is part of the page: open by its attribute, the focus left alone.
    if (dialog === null || !open || !modal) return;
    previousFocus.current = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const first = initialFocus?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
    first.focus();
    return () => {
      if (dialog.open) dialog.close();
      returnTarget(previousFocus.current, (el) => el.isConnected)?.focus();
    };
  }, [open, modal, initialFocus]);

  // The browser's own Escape close is replaced by the caller's decision.
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (dismissible) onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape" && !modal) {
      event.preventDefault();
      if (dismissible) onClose();
      return;
    }
    // Inline, the dialog is part of the page: Tab moves on through the page.
    if (event.key !== "Tab" || !modal) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    const next = items[trappedIndex(items.indexOf(document.activeElement as HTMLElement), items.length, event.shiftKey)];
    event.preventDefault();
    next?.focus();
  };

  if (!open) return null;
  return (
    <dialog ref={ref} open={modal ? undefined : true} className={modal ? styles.dialog : `${styles.dialog} ${styles.inline}`}
      aria-labelledby={titleId}
      onCancel={onCancel} onKeyDown={onKeyDown}>
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {children}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </dialog>
  );
}
