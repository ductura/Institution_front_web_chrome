import { zagrebWall } from "../i18n/zagreb";

/**
 * DAN-913-1: the student's own access log as days of Europe/Zagreb, newest
 * first (PRODUCT §5 rule 17), adapted from Ductus
 * src/domain/privacy/access-log-days.ts (DAN-294). Each stored opening is one
 * row of five minutes; rows are never merged and nothing is counted or timed
 * (D-274 MQ10). The entries are student.access-log.get as createApi() checked
 * them against the contract (id, the five-minute `at`, the enums with
 * `unknown`, the name pair or null), so nothing is checked twice here. The
 * log is read page by page (`next`, `continued`), never merged across pages.
 */

const WINDOW_MS = 5 * 60_000;

export type AccessLogRole = "teacher" | "mentor" | "seminar_teacher" | "unknown";
export type AccessLogSurface = "live_view" | "process_summary" | "fast_path" | "replay" | "submitted_text" | "unknown";

/** One entry of student.access-log.get. */
export type AccessLogEntry = {
  id: string;
  /** The window's start, `2026-11-10T13:10:00.000Z`. */
  at: string;
  role: AccessLogRole;
  surface: AccessLogSurface;
  /** Null when the reader has no name pair; never a stand-in. */
  reader: { givenName: string; familyName: string } | null;
};

export type AccessLogRow = Omit<AccessLogEntry, "at"> & {
  /** Epoch milliseconds of the window's start, for an unambiguous `datetime`. */
  at: number;
  /** Zagreb wall clock of the window, `14:10` and `14:15`. */
  from: string;
  to: string;
};

export type AccessLogDay = {
  /** Zagreb date, `2026-11-10`. */
  key: string;
  year: number;
  /** 1-based. */
  month: number;
  day: number;
  /** 0 is Sunday. */
  weekday: number;
  entries: AccessLogRow[];
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const clock = (ms: number) => {
  const wall = zagrebWall(ms);
  return `${pad2(wall.hour)}:${pad2(wall.minute)}`;
};

/** The entries as Zagreb days, newest day and row first; a repeated id is shown once. */
export function accessLogDaysOf(entries: readonly AccessLogEntry[]): AccessLogDay[] {
  const unique = new Map<string, AccessLogRow>();
  for (const { at, ...rest } of entries) {
    if (unique.has(rest.id)) continue;
    const ms = Date.parse(at);
    unique.set(rest.id, { ...rest, at: ms, from: clock(ms), to: clock(ms + WINDOW_MS) });
  }
  const sorted = [...unique.values()].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const days: AccessLogDay[] = [];
  for (const row of sorted) {
    const wall = zagrebWall(row.at);
    const key = `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, year: wall.year, month: wall.month, day: wall.day,
        weekday: new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay(), entries: [] };
      days.push(day);
    }
    day.entries.push(row);
  }
  return days;
}
