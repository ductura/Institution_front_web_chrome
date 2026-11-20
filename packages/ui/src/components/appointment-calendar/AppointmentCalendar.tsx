"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import styles from "./AppointmentCalendar.module.css";
import { formatHrDate, inRange, monthGrid } from "../date-picker/date-logic";
import { DEFAULT_SLOTS, addMonths, clampDay, dayMark, formatMoment, gridKeyTarget, openingFocus, parseMoment, slotMark, type Appointment } from "./appointment-logic";

export type AppointmentCalendarLabels = {
  calendar: string;
  previousMonth: string;
  nextMonth: string;
  months: readonly string[];
  weekdays: readonly string[];
  /** Heading above the times of the chosen day. */
  times: string;
  proposed: string;
  confirmed: string;
  /** Shown when no day is chosen yet. */
  chooseDay: string;
  /** Live text for the chosen moment, e.g. "Odabrano: 20. 11. 2026. u 12:00". */
  selected: (date: string, time: string) => string;
};

export type AppointmentCalendarProps = {
  /** Appointments the app already knows, "yyyy-mm-ddTHH:MM" local time. */
  appointments: readonly Appointment[];
  /** Chosen moment "yyyy-mm-ddTHH:MM" or "". */
  value: string;
  /** Called with "yyyy-mm-ddTHH:MM" when both a day and a time are chosen. */
  onSelect: (moment: string) => void;
  labels: AppointmentCalendarLabels;
  today: string;
  slots?: readonly string[];
  min?: string;
  max?: string;
  disabled?: boolean;
};

/** Appointment calendar: month grid (arrows, PageUp/PageDown, Home/End) plus time slots; marks proposed and confirmed appointments. No network. */
export function AppointmentCalendar({ appointments, value, onSelect, labels, today, slots = DEFAULT_SLOTS, min, max, disabled = false }: AppointmentCalendarProps) {
  const chosen = parseMoment(value);
  const [focus, setFocusRaw] = useState(() => clampDay(openingFocus(value, appointments, today), min, max));
  const [day, setDay] = useState(chosen?.date ?? "");
  const [seen, setSeen] = useState(value);
  const setFocus = (target: string) => setFocusRaw(clampDay(target, min, max));
  // A controlled value that changes after mount (load, reset) moves the day and month with it.
  if (value !== seen) {
    setSeen(value);
    const next = parseMoment(value);
    setDay(next?.date ?? "");
    if (next !== null) setFocusRaw(clampDay(next.date, min, max));
  }
  const grid = useRef<HTMLTableElement>(null);

  const moveTo = (target: string) => {
    setFocus(target);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-day="${target}"]`)?.focus());
  };
  const onGridKey = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = gridKeyTarget(focus, event.key);
    if (target === null) return;
    event.preventDefault();
    moveTo(target);
  };
  const pick = (time: string) => { if (day !== "" && inRange(day, min, max)) onSelect(formatMoment({ date: day, time })); };

  const [year, month] = focus.split("-").map(Number) as [number, number];
  const mark = (status: string | null) => status === "confirmed" ? labels.confirmed : status === "proposed" ? labels.proposed : "";
  return (
    <div className={styles.root} role="group" aria-label={labels.calendar}>
      <div className={styles.nav}>
        <button type="button" className={styles.button} disabled={disabled} aria-label={labels.previousMonth} onClick={() => setFocus(addMonths(focus, -1))}>‹</button>
        <span aria-live="polite">{labels.months[month - 1]} {year}.</span>
        <button type="button" className={styles.button} disabled={disabled} aria-label={labels.nextMonth} onClick={() => setFocus(addMonths(focus, 1))}>›</button>
      </div>
      <table ref={grid} role="grid" className={styles.grid} onKeyDown={onGridKey} aria-label={`${labels.months[month - 1]} ${year}.`}>
        <thead><tr>{labels.weekdays.map((d) => <th key={d} scope="col" abbr={d}>{d}</th>)}</tr></thead>
        <tbody>
          {monthGrid(year, month).map((week, w) => (
            <tr key={w}>
              {week.map((d, i) => {
                if (d === null) return <td key={i} />;
                const status = dayMark(d, appointments);
                return (
                  <td key={d}>
                    <button type="button" data-day={d} data-mark={status ?? undefined} className={styles.day} tabIndex={d === focus ? 0 : -1}
                      aria-pressed={d === day} disabled={disabled || !inRange(d, min, max)} onClick={() => { setDay(d); setFocus(d); }}
                      aria-label={[formatHrDate(d), mark(status)].filter(Boolean).join(", ")}>
                      {Number(d.slice(8))}{status !== null && <span className={styles.dot} aria-hidden="true" data-status={status} />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.times}>
        <p className={styles.heading}>{day === "" ? labels.chooseDay : `${labels.times} ${formatHrDate(day)}`}</p>
        <div className={styles.slots} role="group" aria-label={labels.times}>
          {slots.map((time) => {
            const status = day === "" ? null : slotMark(day, time, appointments);
            return (
              <button key={time} type="button" data-time={time} data-mark={status ?? undefined} className={styles.slot}
                disabled={disabled || day === ""} aria-pressed={chosen !== null && chosen.date === day && chosen.time === time}
                aria-label={[time, mark(status)].filter(Boolean).join(", ")} onClick={() => pick(time)}>
                {time}{status !== null && <span className={styles.tag}>{mark(status)}</span>}
              </button>
            );
          })}
        </div>
        {chosen !== null && <p className={styles.chosen} role="status">{labels.selected(formatHrDate(chosen.date), chosen.time)}</p>}
      </div>
    </div>
  );
}
