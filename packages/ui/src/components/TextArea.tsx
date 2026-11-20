import { useId, type Ref, type TextareaHTMLAttributes } from "react";

import styles from "./Forms.module.css";

export type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  busy?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

/** A multi-line field (WEB-05), the same rules as TextField. */
export function TextArea({ label, hint, error, busy = false, className, rows = 4, ...rest }: TextAreaProps) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <textarea {...rest} id={id} rows={rows} className={`${styles.input} ${styles.area}`}
        readOnly={busy || rest.readOnly} aria-busy={busy || undefined}
        aria-invalid={error ? true : undefined} aria-describedby={note ? `${id}-note` : undefined} />
      {note && <p id={`${id}-note`} className={styles.note} data-error={error ? "" : undefined}>{note}</p>}
    </div>
  );
}
