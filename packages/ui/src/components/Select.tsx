import { useId, type SelectHTMLAttributes } from "react";

import styles from "./Forms.module.css";

export type SelectOption = { readonly value: string; readonly label: string };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  label: string;
  options: readonly SelectOption[];
  /** A first, empty choice (value ""), e.g. "Odaberite…". */
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Options still loading: the field stays focusable but cannot be changed. */
  busy?: boolean;
};

/** A native select with label, hint and error (WEB-05). */
export function Select({ label, options, placeholder, hint, error, busy = false, className, onChange, ...rest }: SelectProps) {
  const id = useId();
  const note = error ?? hint;
  const hold = busy ? (event: { preventDefault: () => void }) => event.preventDefault() : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <select {...rest} id={id} className={styles.input}
        aria-busy={busy || undefined} aria-disabled={busy || undefined} onMouseDown={hold}
        onKeyDown={busy ? (event) => { if (event.key !== "Tab") event.preventDefault(); } : rest.onKeyDown}
        onChange={busy ? undefined : onChange}
        aria-invalid={error ? true : undefined} aria-describedby={note ? `${id}-note` : undefined}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {note && <p id={`${id}-note`} className={styles.note} data-error={error ? "" : undefined}>{note}</p>}
    </div>
  );
}
