"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";

import { FOCUSABLE, returnTarget, trappedIndex } from "../dialog-focus";
import styles from "./Drawer.module.css";
import { isBackdropClick } from "./drawer-click";

export type DrawerSide = "left" | "right";

export type DrawerProps = {
  open: boolean;
  /** Which edge it slides from: the rail (structure) on the left, the side panel on the right. */
  side: DrawerSide;
  /** Names the drawer for assistive technology and heads it. */
  title: string;
  children?: ReactNode;
  /** Escape, a click on the scrim or the close button: the drawer never closes itself. */
  onClose: () => void;
  /** Takes the focus on opening; the first focusable element otherwise. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** The accessible name of the close button. */
  closeLabel?: string;
  /** false: shown in the page flow, without the inert backdrop (the catalogue and previews). */
  modal?: boolean;
};

/**
 * The shared drawer (UI-6A): a native modal `<dialog>` fixed to the left or
 * right edge. The page behind is inert, Tab and Shift+Tab wrap inside it,
 * Escape and a click on the scrim call `onClose`, and on closing the focus
 * goes back to what opened it.
 */
export function Drawer({
  open, side, title, children, onClose, initialFocus, closeLabel = "Zatvori", modal = true,
}: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
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
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape" && !modal) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !modal) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    const next = items[trappedIndex(items.indexOf(document.activeElement as HTMLElement), items.length, event.shiftKey)];
    event.preventDefault();
    next?.focus();
  };

  // The scrim is the dialog's own backdrop: a click whose target is the dialog itself, not its content.
  // The dialog fills the viewport's height, so its own empty space is told from the scrim by the click's coordinates.
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (modal && event.target === event.currentTarget && isBackdropClick(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())) onClose();
  };

  if (!open) return null;
  const classes = [styles.drawer, side === "left" ? styles.left : styles.right, modal ? "" : styles.inline].filter(Boolean).join(" ");
  return (
    <dialog ref={ref} open={modal ? undefined : true} className={classes} aria-labelledby={titleId}
      onCancel={onCancel} onKeyDown={onKeyDown} onClick={onClick}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>✕</button>
      </div>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
