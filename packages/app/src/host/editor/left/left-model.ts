// WEB-2126 (par-e-lijevi-panel): the left panel as data. Everything here is
// pure; the sections read the editor and this device's storage through it.
// What the server does not give (rules, deadlines, sources) stays "nedostupno";
// nothing is invented. Local notes never enter the text, the export or a submission.

export type ChapterState = "draft" | "working" | "done";
export const CHAPTER_STATES: readonly ChapterState[] = ["draft", "working", "done"];

export type WordGoal = { readonly min?: number | null; readonly max?: number | null };

/** The state a chapter has until the student sets one: empty is a draft, anything else in progress. */
export function defaultState(words: number): ChapterState {
  return words > 0 ? "working" : "draft";
}

/** Whether `words` meets the goal; a goal without limits is met. */
export function goalStatus(words: number, goal: WordGoal | undefined): "met" | "below" | "above" | "none" {
  const min = goal?.min ?? null;
  const max = goal?.max ?? null;
  if (min === null && max === null) return "none";
  if (min !== null && words < min) return "below";
  if (max !== null && words > max) return "above";
  return "met";
}

/** Share of the lower limit written, 0 to 1; with only a maximum, the share of it. */
export function progressRatio(words: number, goal: WordGoal | undefined): number | null {
  const target = goal?.min ?? goal?.max ?? null;
  if (target === null || target <= 0) return null;
  return Math.min(1, Math.max(0, words / target));
}

/** About 300 words to a page (the prototype's "oko N str."). */
export function pagesOf(words: number): number {
  return Math.max(0, Math.round(words / 300));
}

const DAY = 86_400_000;

/**
 * ED-37 (P2-6): the calendar day of an instant in Zagreb (YYYY-MM-DD), the day
 * a deadline such as the submission's `dueAt` falls on; null for no instant.
 */
export function zagrebDay(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whole calendar days from `now` to the ISO date (YYYY-MM-DD); null for anything else. */
export function daysUntil(isoDate: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d);
  if (Number.isNaN(target) || new Date(target).getUTCDate() !== d) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / DAY);
}

// ---- Local storage ------------------------------------------------------

export type Store = Pick<Storage, "getItem" | "setItem">;
export const storageKey = (kind: string, workId: string): string => `ductura.editor.left.${kind}:${workId}`;

export function readJson<T>(store: Store | null, key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = store?.getItem(key);
    return raw ? parse(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(store: Store | null, key: string, value: unknown): boolean {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export type ChapterStates = Readonly<Record<string, ChapterState>>;
export function parseStates(raw: unknown): ChapterStates {
  if (!isRecord(raw)) return {};
  const out: Record<string, ChapterState> = {};
  for (const [key, value] of Object.entries(raw)) if (CHAPTER_STATES.includes(value as ChapterState)) out[key] = value as ChapterState;
  return out;
}

export const MAX_TEXT = 2000;
export const clean = (text: string, max = MAX_TEXT): string => text.replace(/\r\n?/gu, "\n").trim().slice(0, max);

/** A plain text map keyed by chapter id (purpose and note). Empty text removes the key. */
export type TextMap = Readonly<Record<string, string>>;
export function parseTextMap(raw: unknown): TextMap {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value !== "") out[key] = clean(value);
  return out;
}
export function withText(map: TextMap, key: string, text: string): TextMap {
  const { [key]: _gone, ...rest } = map;
  const next = clean(text);
  return next === "" ? rest : { ...rest, [key]: next };
}

// ---- Stash ("Odloženo") -------------------------------------------------

export type StashItem = { readonly id: string; readonly text: string; readonly at: string };
export const MAX_STASH = 50;

export function parseStash(raw: unknown): StashItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): StashItem[] => isRecord(item) && typeof item.id === "string" && typeof item.text === "string" && typeof item.at === "string" && item.text !== ""
    ? [{ id: item.id, text: item.text.slice(0, 20_000), at: item.at }] : []).slice(0, MAX_STASH);
}
export function stashAdd(items: readonly StashItem[], text: string, id: string, at: string): StashItem[] {
  return text.trim() === "" ? [...items] : [{ id, text, at }, ...items].slice(0, MAX_STASH);
}
export const stashRemove = (items: readonly StashItem[], id: string): StashItem[] => items.filter((item) => item.id !== id);

/** The first words of a stashed text, for the list. */
export function preview(text: string, length = 60): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

// ---- Own deadlines ------------------------------------------------------

export type OwnDeadline = { readonly id: string; readonly label: string; readonly date: string };
export const MAX_DEADLINES = 20;

export function parseDeadlines(raw: unknown): OwnDeadline[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): OwnDeadline[] => isRecord(item) && typeof item.id === "string" && typeof item.label === "string" && typeof item.date === "string"
    && item.label.trim() !== "" && daysUntil(item.date, new Date(2000, 0, 1)) !== null
    ? [{ id: item.id, label: clean(item.label, 80), date: item.date }] : []).slice(0, MAX_DEADLINES);
}
export function addDeadline(items: readonly OwnDeadline[], label: string, date: string, id: string): OwnDeadline[] | null {
  const name = clean(label, 80);
  if (name === "" || daysUntil(date, new Date(2000, 0, 1)) === null || items.length >= MAX_DEADLINES) return null;
  return [...items, { id, label: name, date }].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Thread of the work (thesis, hypotheses) -----------------------------

export type Thread = { readonly question: string; readonly hypotheses: readonly string[] };
export const EMPTY_THREAD: Thread = { question: "", hypotheses: [] };
export const MAX_HYPOTHESES = 12;
export function parseThread(raw: unknown): Thread {
  if (!isRecord(raw)) return EMPTY_THREAD;
  return {
    question: typeof raw.question === "string" ? clean(raw.question) : "",
    hypotheses: Array.isArray(raw.hypotheses) ? raw.hypotheses.filter((h): h is string => typeof h === "string").map((h) => clean(h, 500)).slice(0, MAX_HYPOTHESES) : [],
  };
}
