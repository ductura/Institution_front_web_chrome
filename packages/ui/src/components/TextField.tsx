import { useId, type InputHTMLAttributes, type Ref } from "react";

import styles from "./TextField.module.css";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: string;
  /** Shown under the field and announced with it; marks the field invalid. */
  error?: string;
  busy?: boolean;
  /** Marks the field invalid without a message under it (the prototype's toast + aria-invalid). */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export function TextField({ label, hint, error, busy = false, invalid = false, className, ...rest }: TextFieldProps) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        {...rest}
        id={id}
        className={styles.input}
        readOnly={busy || rest.readOnly}
        aria-busy={busy || undefined}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
      />
      {note && <p id={`${id}-note`} className={styles.note} data-error={error ? "" : undefined}>{note}</p>}
    </div>
  );
}
