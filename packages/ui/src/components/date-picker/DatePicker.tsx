"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import styles from "./DatePicker.module.css";
import { formatHrDate, gridKeyTarget, inRange, monthGrid, parseHrDate, addMonths } from "./date-logic";

export type DatePickerLabels = {
  field: string;
  /** Button that opens the calendar. */
  choose: string;
  previousMonth: string;
  nextMonth: string;
  /** Shown under the field when the typed text is not a date or is out of range. */
  invalid: string;
  /** Month names, January first, and weekday abbreviations, Monday first. */
  months: readonly string[];
  weekdays: readonly string[];
};

export type DatePickerProps = {
  /** ISO "yyyy-mm-dd" or "" for none. */
  value: string;
  onChange: (value: string) => void;
  labels: DatePickerLabels;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Day shown when there is no value; the page passes "today" so the picker stays pure. */
  today: string;
};

/** Date picker: type "d. M. yyyy." or choose in a month grid with arrows, PageUp/PageDown, Home/End, Enter and Escape. */
export function DatePicker({ value, onChange, labels, min, max, disabled = false, today }: DatePickerProps) {
  const [text, setText] = useState(formatHrDate(value));
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(value || today);
  const [bad, setBad] = useState(false);
  const grid = useRef<HTMLTableElement>(null);
  const id = useId();

  const commitText = (raw: string) => {
    if (raw.trim() === "") { setBad(false); onChange(""); return; }
    const parsed = parseHrDate(raw);
    if (parsed === null || !inRange(parsed, min, max)) { setBad(true); return; }
    setBad(false);
    setText(formatHrDate(parsed));
    setFocus(parsed);
    onChange(parsed);
  };
  const choose = (day: string) => {
    if (!inRange(day, min, max)) return;
    setText(formatHrDate(day)); setBad(false); setOpen(false); onChange(day);
  };
  const moveTo = (day: string) => {
    setFocus(day);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.focus());
  };
  const onGridKey = (event: KeyboardEvent<HTMLTableElement>) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    const target = gridKeyTarget(focus, event.key);
    if (target === null) return;
    event.preventDefault();
    moveTo(target);
  };

  const [year, month] = focus.split("-").map(Number) as [number, number];
  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>{labels.field}</label>
      <div className={styles.row}>
        <input id={id} type="text" inputMode="numeric" className={styles.input} value={text} disabled={disabled}
          placeholder="d. M. gggg." aria-invalid={bad} aria-describedby={bad ? `${id}-err` : undefined} autoComplete="off"
          onChange={(event) => setText(event.target.value)} onBlur={(event) => commitText(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") commitText(event.currentTarget.value); }} />
        <button type="button" className={styles.button} disabled={disabled} aria-expanded={open} aria-haspopup="dialog"
          aria-label={labels.choose} onClick={() => { setOpen(!open); if (!open) moveTo(focus); }}>▾</button>
      </div>
      {bad && <p id={`${id}-err`} className={styles.error} role="alert">{labels.invalid}</p>}
      {open && (
        <div role="dialog" aria-label={labels.choose} className={styles.popup}>
          <div className={styles.nav}>
            <button type="button" className={styles.button} aria-label={labels.previousMonth} onClick={() => setFocus(addMonths(focus, -1))}>‹</button>
            <span aria-live="polite">{labels.months[month - 1]} {year}.</span>
            <button type="button" className={styles.button} aria-label={labels.nextMonth} onClick={() => setFocus(addMonths(focus, 1))}>›</button>
          </div>
          <table ref={grid} role="grid" className={styles.grid} onKeyDown={onGridKey} aria-label={`${labels.months[month - 1]} ${year}.`}>
            <thead><tr>{labels.weekdays.map((d) => <th key={d} scope="col" abbr={d}>{d}</th>)}</tr></thead>
            <tbody>
              {monthGrid(year, month).map((week, w) => (
                <tr key={w}>
                  {week.map((day, i) => day === null ? <td key={i} /> : (
                    <td key={day}>
                      <button type="button" data-day={day} className={styles.day} tabIndex={day === focus ? 0 : -1}
                        aria-pressed={day === value} disabled={!inRange(day, min, max)} onClick={() => choose(day)}
                        aria-label={formatHrDate(day)}>{Number(day.slice(8))}</button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
