// ED-77 (paritet, prototip tools.js „DANAŠNJA SESIJA”): a writing session with a small goal for this sitting.
// The open session and the last sessions are kept on this device only, under the person's journal scope and the
// work, so another person on the same browser never sees them. Nothing here edits the work or leaves the browser.
import { wordCount, type ReviewDoc } from "../../../../../../src/components/editor/review/model";

export type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The goals the dialog offers; 0 is "bez cilja". */
export const WORD_GOALS = [150, 300, 500, 0] as const;
export const MINUTE_GOALS = [25, 45, 90, 0] as const;
export const DEFAULT_GOAL = { words: 300, minutes: 45 } as const;
/** How many finished sessions are kept, and how many the summary lists. */
export const MAX_LOG = 20;
export const SHOWN_LOG = 5;

export type OpenSession = {
  /** Start, in ms since the epoch. */
  readonly startedAt: number;
  readonly goalWords: number;
  readonly goalMinutes: number;
  /** Words of the work at the start. */
  readonly startWords: number;
  /** Words of each top chapter at the start, by chapter key. */
  readonly startChapters: Readonly<Record<string, number>>;
};

export type LoggedSession = { readonly endedAt: number; readonly words: number; readonly minutes: number };

export type ChapterChange = { readonly title: string; readonly delta: number };

export type SessionSummary = {
  readonly words: number;
  readonly minutes: number;
  readonly goalWords: number;
  readonly chapters: readonly ChapterChange[];
};

export const sessionKey = (scope: string, workId: string) => `ductura.writing-session:${JSON.stringify([scope, workId])}`;
export const sessionLogKey = (scope: string, workId: string) => `ductura.writing-session-log:${JSON.stringify([scope, workId])}`;

const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const signed = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** Words of the whole work, headings included. */
export function totalWords(doc: ReviewDoc): number {
  return doc.blocks.reduce((sum, block) => sum + wordCount(block.text), 0);
}

export type TopChapter = { readonly key: string; readonly title: string; readonly words: number };

/** The chapters of the highest level present, with the words of their body (subchapters included). */
export function topChapters(doc: ReviewDoc): TopChapter[] {
  if (doc.chapters.length === 0) return [];
  const top = Math.min(...doc.chapters.map((c) => c.level));
  return doc.chapters.filter((c) => c.level === top).map((chapter, i) => {
    let words = 0;
    for (let b = chapter.block + 1; b < chapter.end; b += 1) words += wordCount(doc.blocks[b]!.text);
    const title = [chapter.number, chapter.title].filter((part) => part !== "").join(" ");
    return { key: chapter.id ?? `#${i}`, title, words };
  });
}

export function startSession(doc: ReviewDoc, goal: { words: number; minutes: number }, now: number): OpenSession {
  return {
    startedAt: now, goalWords: goal.words, goalMinutes: goal.minutes, startWords: totalWords(doc),
    startChapters: Object.fromEntries(topChapters(doc).map((c) => [c.key, c.words])),
  };
}

/** Whole minutes since the start, never below 0. */
export const minutesOf = (session: OpenSession, now: number) => Math.max(0, Math.round((now - session.startedAt) / 60_000));

/** What the session did: words against the start, and every top chapter whose words changed. */
export function summarize(session: OpenSession, doc: ReviewDoc, now: number): SessionSummary {
  const chapters = topChapters(doc)
    .map((c) => ({ title: c.title, delta: c.words - (session.startChapters[c.key] ?? 0) }))
    .filter((c) => c.delta !== 0);
  return { words: totalWords(doc) - session.startWords, minutes: minutesOf(session, now), goalWords: session.goalWords, chapters };
}

export function parseSession(raw: string | null | undefined): OpenSession | null {
  if (!raw) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!count(o["startedAt"]) || !count(o["goalWords"]) || !count(o["goalMinutes"]) || !count(o["startWords"])) return null;
  const chapters = o["startChapters"];
  if (typeof chapters !== "object" || chapters === null || Array.isArray(chapters)) return null;
  const startChapters: Record<string, number> = {};
  for (const [k, n] of Object.entries(chapters)) if (count(n)) startChapters[k] = n;
  return { startedAt: o["startedAt"], goalWords: o["goalWords"], goalMinutes: o["goalMinutes"], startWords: o["startWords"], startChapters };
}

export function parseLog(raw: string | null | undefined): LoggedSession[] {
  if (!raw) return [];
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(v)) return [];
  return v.flatMap((e): LoggedSession[] => {
    if (typeof e !== "object" || e === null) return [];
    const o = e as Record<string, unknown>;
    return count(o["endedAt"]) && signed(o["words"]) && count(o["minutes"])
      ? [{ endedAt: o["endedAt"], words: o["words"], minutes: o["minutes"] }] : [];
  }).slice(-MAX_LOG);
}

export function loadSession(storage: SessionStorage | null, scope: string, workId: string): OpenSession | null {
  try { return parseSession(storage?.getItem(sessionKey(scope, workId))); } catch { return null; }
}

export function loadLog(storage: SessionStorage | null, scope: string, workId: string): LoggedSession[] {
  try { return parseLog(storage?.getItem(sessionLogKey(scope, workId))); } catch { return []; }
}

export function saveSession(storage: SessionStorage | null, scope: string, workId: string, session: OpenSession | null): void {
  try {
    if (session === null) storage?.removeItem(sessionKey(scope, workId));
    else storage?.setItem(sessionKey(scope, workId), JSON.stringify(session));
  } catch { /* the session then lives only in this tab */ }
}

/** Adds the finished session to the log (newest last, at most MAX_LOG) and gives the log as kept. */
export function appendLog(storage: SessionStorage | null, scope: string, workId: string, entry: LoggedSession): LoggedSession[] {
  const log = [...loadLog(storage, scope, workId), entry].slice(-MAX_LOG);
  try { storage?.setItem(sessionLogKey(scope, workId), JSON.stringify(log)); } catch { /* shown, not kept */ }
  return log;
}

/** The last sessions, newest first, as the summary lists them. */
export const recentSessions = (log: readonly LoggedSession[]) => log.slice(-SHOWN_LOG).reverse();
