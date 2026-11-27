// ED-110: the writing session (prototype tools.js sessNew/sessStart/sessEnd, "Sesija pisanja").
// Everything here is pure; the host keeps the session and its log on this device only.
import type { NumberedHeading } from "../../../../../editor-core/src/editor/chapter-numbers.ts";

export const WORD_GOALS = [150, 300, 500] as const;
export const MINUTE_GOALS = [25, 45, 90] as const;
export const LOG_LIMIT = 20;
export const SHOWN_LOG = 5;
const MINUTE = 60_000;

export type Goals = { readonly words: number | null; readonly minutes: number | null };
export const DEFAULT_GOALS: Goals = { words: 300, minutes: 45 };

export type Session = {
  readonly t0: number;
  readonly goalW: number | null;
  readonly goalM: number | null;
  /** Words in the work when the session started. */
  readonly w0: number;
  /** Words per chapter (level-2 heading id) when the session started. */
  readonly ch0: Readonly<Record<string, number>>;
};

export type LogEntry = { readonly at: number; readonly words: number; readonly min: number };

export type Chapter = { readonly id: string; readonly title: string; readonly words: number };

export type Summary = {
  readonly words: number;
  readonly minutes: number;
  readonly goalW: number | null;
  readonly chapters: readonly { readonly title: string; readonly delta: number }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const goal = (value: unknown): number | null => (count(value) && value > 0 ? Math.round(value) : null);

export function parseGoals(raw: unknown): Goals {
  if (!isRecord(raw)) return DEFAULT_GOALS;
  return { words: goal(raw.words), minutes: goal(raw.minutes) };
}

export function parseSession(raw: unknown): Session | null {
  if (!isRecord(raw) || !count(raw.t0) || !count(raw.w0)) return null;
  const ch0: Record<string, number> = {};
  if (isRecord(raw.ch0)) for (const [id, words] of Object.entries(raw.ch0)) if (count(words)) ch0[id] = words;
  return { t0: raw.t0, w0: raw.w0, goalW: goal(raw.goalW), goalM: goal(raw.goalM), ch0 };
}

export function parseLog(raw: unknown): readonly LogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => isRecord(entry) && count(entry.at) && count(entry.words) && count(entry.min)
    ? [{ at: entry.at, words: entry.words, min: entry.min }] : []).slice(-LOG_LIMIT);
}

/** Level-2 chapters with their words: a chapter holds its own words and those of its subheadings. */
export function chapterWords(headings: readonly NumberedHeading[], words: readonly number[], untitled: string): readonly Chapter[] {
  const chapters: { id: string; title: string; words: number }[] = [];
  let open: { id: string; title: string; words: number } | null = null;
  headings.forEach((heading, index) => {
    const own = words[index] ?? 0;
    if (heading.level <= 2) {
      open = heading.level === 2 && heading.id ? { id: heading.id, title: `${heading.number}. ${heading.title || untitled}`, words: own } : null;
      if (open) chapters.push(open);
    } else if (open) open.words += own;
  });
  return chapters;
}

export function startSession(goals: Goals, total: number, chapters: readonly Chapter[], now: number): Session {
  return { t0: now, goalW: goals.words, goalM: goals.minutes, w0: total, ch0: Object.fromEntries(chapters.map((c) => [c.id, c.words])) };
}

/** Whole minutes since the start, never below zero. */
export function minutesSince(session: Session, now: number): number {
  return Math.max(0, Math.floor((now - session.t0) / MINUTE));
}

export function summarize(session: Session, total: number, chapters: readonly Chapter[], now: number): Summary {
  const changed = chapters.flatMap((chapter) => {
    const delta = chapter.words - (session.ch0[chapter.id] ?? 0);
    return delta === 0 ? [] : [{ title: chapter.title, delta }];
  });
  return { words: total - session.w0, minutes: minutesSince(session, now), goalW: session.goalW, chapters: changed };
}

export function logAdd(log: readonly LogEntry[], summary: Summary, at: number): readonly LogEntry[] {
  return [...log, { at, words: summary.words, min: summary.minutes }].slice(-LOG_LIMIT);
}

/** Croatian plural of "riječ": 1, 21, 31 … take "riječ", the rest "riječi". */
export function wordsLabel(n: number): string {
  const abs = Math.abs(n);
  return abs % 10 === 1 && abs % 100 !== 11 ? "riječ" : "riječi";
}
