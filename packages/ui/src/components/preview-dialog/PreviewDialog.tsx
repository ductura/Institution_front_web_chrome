"use client";

import { useRef, type ReactNode } from "react";

import { Button } from "../Button";
import { Dialog } from "../Dialog";
import { previewDialogHr } from "./messages.hr";
import styles from "./PreviewDialog.module.css";

export type PreviewKind = "table" | "image";

export type PreviewDialogProps = {
  open: boolean;
  kind: PreviewKind;
  /** The object shown: a table, or an image with its alt text. */
  children: ReactNode;
  /** A line under the preview (e.g. the source or the caption of the object). */
  caption?: string;
  /** Escape, the close button or the caller's own close. */
  onClose: () => void;
  /** Overrides the title taken from `kind`. */
  title?: string;
  modal?: boolean;
};

/**
 * Preview of a table or an image in a dialog (UI-10A), on the shared Dialog:
 * the focus lands on "Zatvori", Tab stays inside, Escape closes and the focus
 * returns to what opened it.
 */
export function PreviewDialog({ open, kind, children, caption, onClose, title, modal }: PreviewDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} modal={modal} title={title ?? previewDialogHr[kind]} onClose={onClose} initialFocus={closeRef}
      actions={<Button ref={closeRef} tone="quiet" onClick={onClose}>{previewDialogHr.close}</Button>}>
      <div className={styles.stage}>{children}</div>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </Dialog>
  );
}
