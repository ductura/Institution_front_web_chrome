// WEB-2128: the "Rokovi" section (plus.js): submission deadline, revision
// deadline asked by the mentor and the student's own deadlines, sorted by date.
import { assistHr as t } from "./messages.hr";

export type Deadline = { readonly key: string; readonly label: string; readonly date: string; readonly note: string };
export type DeadlineRow = { readonly key: string; readonly label: string; readonly when: string; readonly note: string; readonly past: boolean; readonly days: number };

const DAY = 86_400_000;

/** Whole days from `today` to `date` (ISO yyyy-mm-dd); null for anything else. */
export function daysUntil(date: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (!m) return null;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(target)) return null;
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - start) / DAY);
}

export const formatDate = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}.` : date;
};

export function deadlineRows(deadlines: readonly Deadline[], today: Date): DeadlineRow[] {
  return deadlines.flatMap((d) => {
    const days = daysUntil(d.date, today);
    if (days === null) return [];
    const rel = days < 0 ? t.deadlines.past : days === 0 ? t.deadlines.today : t.deadlines.inDays(days);
    return [{ key: d.key, label: d.label, when: `${formatDate(d.date)} · ${rel}`, note: d.note, past: days < 0, days }];
  }).sort((a, b) => a.days - b.days);
}
