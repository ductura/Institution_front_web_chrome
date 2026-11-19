"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./Toast.module.css";
import { addToast, removeToast, toastTimeout, type ToastItem, type ToastTone } from "./toast-queue";

export type ToastRegionProps = {
  toasts: readonly ToastItem[];
  onDismiss: (id: number) => void;
  /** The region's name for assistive technology (e.g. "Obavijesti"). */
  label: string;
  /** The close button's text (e.g. "Zatvori"). */
  closeLabel: string;
  /** In the page flow instead of fixed to the viewport (the catalogue and previews). */
  inline?: boolean;
};

/**
 * Where toasts show (WEB-04). Both live regions are on the page before any
 * message, so a screen reader announces each one: neutral ones politely
 * (role="status"), errors at once (role="alert").
 */
export function ToastRegion({ toasts, onDismiss, label, closeLabel, inline = false }: ToastRegionProps) {
  const item = (toast: ToastItem) => (
    <div key={toast.id} className={styles.toast} data-tone={toast.tone}>
      <p className={styles.text}>{toast.text}</p>
      <button type="button" className={styles.close} onClick={() => onDismiss(toast.id)}>{closeLabel}</button>
    </div>
  );
  return (
    <section aria-label={label} className={inline ? `${styles.region} ${styles.inline}` : styles.region}>
      <div role="status" aria-live="polite" className={styles.list}>
        {toasts.filter((t) => t.tone !== "error").map(item)}
      </div>
      <div role="alert" aria-live="assertive" className={styles.list}>
        {toasts.filter((t) => t.tone === "error").map(item)}
      </div>
    </section>
  );
}

/** The page's toasts: `show` adds one, a neutral one leaves by itself after TOAST_TIMEOUT_MS. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => removeToast(list, id));
  }, []);

  const show = useCallback((text: string, tone: ToastTone = "neutral") => {
    const id = nextId.current++;
    setToasts((list) => addToast(list, { id, text, tone }));
    const wait = toastTimeout(tone);
    if (wait !== null) timers.current.set(id, setTimeout(() => dismiss(id), wait));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, show, dismiss };
}
