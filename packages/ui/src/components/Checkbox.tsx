import { useId, type InputHTMLAttributes } from "react";

import styles from "./Forms.module.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  label: string;
  hint?: string;
  /** Shown under the box and announced with it; marks it invalid. */
  error?: string;
};

/** A checkbox with its label as a 44 px target (WEB-05). */
export function Checkbox({ label, hint, error, className, ...rest }: CheckboxProps) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.check}>
        <input {...rest} id={id} type="checkbox" className={styles.box}
          aria-invalid={error ? true : undefined} aria-describedby={note ? `${id}-note` : undefined} />
        <span>{label}</span>
      </label>
      {note && <p id={`${id}-note`} className={styles.note} data-error={error ? "" : undefined}>{note}</p>}
    </div>
  );
}
