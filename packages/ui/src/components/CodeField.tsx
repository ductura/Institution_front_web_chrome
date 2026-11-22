import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import styles from "./CodeField.module.css";

export type CodeFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** The quiet line under the field; it stays when there is an error too (E-5 shows both). */
  hint?: string;
  /** Said under the field at once (role="alert"); marks the field invalid. */
  error?: string;
  busy?: boolean;
  /** The submit button next to the field (the prototype's .up-row). */
  action?: ReactNode;
};

/**
 * The prototype's code field (E-5 `.field` + `.up-row`): a centred label, a mono
 * upper-case field with the submit button in the same row, then the error and the hint.
 */
export function CodeField({ label, hint, error, busy = false, action, className, ...rest }: CodeFieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <span className={styles.row}>
        <input
          {...rest}
          id={id}
          className={styles.input}
          readOnly={busy || rest.readOnly}
          aria-busy={busy || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {action}
      </span>
      {error ? <p id={`${id}-error`} role="alert" className={styles.error}>{error}</p> : null}
      {hint ? <p id={`${id}-hint`} className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
