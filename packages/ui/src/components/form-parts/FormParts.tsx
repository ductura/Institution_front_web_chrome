import type { ReactNode } from "react";

import styles from "./form-parts.module.css";

/** One titled part of a long form (prototype `.task`): a rule above and a heading, labelled by it. */
export function FormSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className={styles.section} aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

export type OptionChoice = { value: string; label: string; disabled?: boolean };

export type OptionGroupProps = {
  legend: string;
  /** Radio group name; with `kind="checkbox"` it is the name of every box. */
  name: string;
  options: readonly OptionChoice[];
  /** Radios: the selected value. Checkboxes: the checked values. */
  value: string | readonly string[];
  onChange?: (value: string, checked: boolean) => void;
  kind?: "radio" | "checkbox";
  /** Whole group read only (prototype: a fieldset that is not offered yet). */
  disabled?: boolean;
};

/** The prototype's fieldset with 44 px option rows; unavailable options stay visible and disabled. */
export function OptionGroup({ legend, name, options, value, onChange, kind = "radio", disabled }: OptionGroupProps) {
  const checked = (option: OptionChoice) => (typeof value === "string" ? value === option.value : value.includes(option.value));
  return (
    <fieldset className={styles.group} disabled={disabled}>
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className={styles.opt}>
          <input type={kind} name={name} value={option.value} checked={checked(option)} disabled={option.disabled}
            onChange={(event) => onChange?.(option.value, event.target.checked)} />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export type SummaryRowData = { id: string; label: string; value: ReactNode };

/** Label on the left, value in mono on the right (prototype `.sb-kv`); stacked on a narrow screen. */
export function SummaryList({ rows }: { rows: readonly SummaryRowData[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((row) => <div key={row.id} className={styles.row}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
  );
}

export type EntryData = { id: string; who: string; text: ReactNode };

/** The prototype's `.sb-entry` lines: a quiet "who · when" above the text, on a 2 px rule. */
export function EntryList({ entries }: { entries: readonly EntryData[] }) {
  return (
    <ol className={styles.entries}>
      {entries.map((entry) => <li key={entry.id} className={styles.entry}><span className={styles.who}>{entry.who}</span><span>{entry.text}</span></li>)}
    </ol>
  );
}

/** Fields side by side while 220 px each fit (prototype `.grid2`), one column otherwise. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** Buttons in a row that wraps; each takes the full width on a narrow screen (prototype `.sb-acts`). */
export function ActionRow({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

/** The prototype's `.banner`: a quiet band with an accent edge, amber for a warning. */
export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return <div className={styles.notice} data-tone={tone} role="status">{children}</div>;
}
