/**
 * ED-96: the prototype's "Sesija pisanja" (tools.js sessNew/sessStart/sessEnd). A small goal for this sitting,
 * kept on this device only, and at the end what changed: words, minutes, the chapters that moved.
 */
import type { Node as PmNode } from "@tiptap/pm/model";

export type SessionGoal = { readonly w: number; readonly m: number };
export type WritingSession = {
  readonly t0: number; readonly goalW: number; readonly goalM: number;
  /** Words of the whole work, and of each chapter by its heading's id, when the session began. */
  readonly w0: number; readonly ch0: Readonly<Record<string, number>>;
};
export type SessionLogEntry = { readonly when: string; readonly words: number; readonly min: number };
export type SessionSummary = {
  readonly words: number; readonly min: number; readonly goalW: number;
  readonly ch: readonly { readonly title: string; readonly delta: number }[];
};
export type WorkCounts = {
  readonly total: number;
  readonly chapters: readonly { readonly id: string; readonly title: string; readonly words: number }[];
};

export const WORD_GOALS = [150, 300, 500, 0] as const;
export const TIME_GOALS = [25, 45, 90, 0] as const;
export const DEFAULT_GOAL: SessionGoal = { w: 300, m: 45 };
/** How many past sessions stay on the device; the summary shows the last five. */
export const LOG_KEPT = 50;

const count = (text: string) => text.split(/\s+/u).filter(Boolean).length;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The work's words, and the words under each chapter (level 2 heading) up to the next one. */
export function countsOf(doc: PmNode): WorkCounts {
  const chapters: { id: string; title: string; words: number }[] = [];
  let total = 0;
  let chapter = 0;
  doc.forEach((node, _offset, index) => {
    if (node.type.name === "heading") {
      const level = Number(node.attrs.level);
      if (level === 2) {
        chapter++;
        const id = typeof node.attrs.nodeId === "string" && node.attrs.nodeId ? node.attrs.nodeId : `h-${index}`;
        chapters.push({ id, title: `${chapter} ${node.textContent.trim()}`.trim(), words: 0 });
      } else if (level < 2) chapters.push({ id: "", title: "", words: 0 });
      total += count(node.textContent);
      return;
    }
    const words = count(node.textBetween(0, node.content.size, " ", " "));
    total += words;
    const last = chapters[chapters.length - 1];
    if (last?.id) last.words += words;
  });
  return { total, chapters: chapters.filter((c) => c.id) };
}

export function startSession(counts: WorkCounts, goal: SessionGoal, now: number): WritingSession {
  return { t0: now, goalW: goal.w, goalM: goal.m, w0: counts.total, ch0: Object.fromEntries(counts.chapters.map((c) => [c.id, c.words])) };
}

export const minutesOf = (s: WritingSession, now: number) => Math.max(0, Math.round((now - s.t0) / 60000));

export function endSession(s: WritingSession, counts: WorkCounts, now: number): SessionSummary {
  const ch = counts.chapters.map((c) => ({ title: c.title, delta: c.words - (s.ch0[c.id] ?? 0) })).filter((c) => c.delta);
  return { words: counts.total - s.w0, min: minutesOf(s, now), goalW: s.goalW, ch };
}

const number = new Intl.NumberFormat("hr-HR");
export const fmt = (n: number) => number.format(n);
export const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n)}`;
export const wordsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "riječ" : "riječi");

/** The panel foot while a session runs: "+N / cilj riječi, M / cilj min". */
export function footLine(s: WritingSession, counts: WorkCounts, now: number): string {
  const dw = counts.total - s.w0;
  return `${signed(dw)}${s.goalW ? ` / ${s.goalW}` : ""} riječi, ${minutesOf(s, now)}${s.goalM ? ` / ${s.goalM}` : ""} min`;
}

export function summaryLine(r: SessionSummary): { lead: string; rest: string } {
  const n = Math.abs(r.words);
  const lead = `${r.words >= 0 ? "Napisano" : "Skraćeno za"} ${fmt(n)} ${wordsWord(n)}`;
  const goal = !r.goalW ? "" : r.words >= r.goalW ? ` Cilj od ${r.goalW} riječi je dosegnut.` : ` Do cilja je ostalo ${r.goalW - r.words} riječi.`;
  return { lead, rest: ` u ${r.min} min.${goal}` };
}

/** "27. 11. 2026. u 19:05", the time a session ended. */
export function whenOf(now: number): string {
  const d = new Date(now);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}. u ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function parseSession(raw: unknown): WritingSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.t0) || !isNum(r.goalW) || !isNum(r.goalM) || !isNum(r.w0)) return null;
  const ch0: Record<string, number> = {};
  if (r.ch0 && typeof r.ch0 === "object") for (const [k, v] of Object.entries(r.ch0)) if (isNum(v)) ch0[k] = v;
  return { t0: r.t0, goalW: r.goalW, goalM: r.goalM, w0: r.w0, ch0 };
}

export function parseLog(raw: unknown): SessionLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is SessionLogEntry => !!e && typeof e === "object" && typeof e.when === "string" && isNum(e.words) && isNum(e.min))
    .slice(-LOG_KEPT);
}

export function parseGoal(raw: unknown): SessionGoal {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    w: (WORD_GOALS as readonly unknown[]).includes(r.w) ? r.w as number : DEFAULT_GOAL.w,
    m: (TIME_GOALS as readonly unknown[]).includes(r.m) ? r.m as number : DEFAULT_GOAL.m,
  };
}

export const sessionHr = {
  start: "Započni sesiju pisanja",
  startHint: "cilj za danas",
  label: "Sesija",
  end: "Završi",
  title: "Sesija pisanja",
  intro: "Postavite mali cilj za ovo sjedenje. Na kraju vidite što ste napravili. Sesije vidite samo Vi.",
  words: "Riječi",
  time: "Vrijeme",
  noGoal: "bez cilja",
  cancel: "Odustani",
  begin: "Započni",
  doneTitle: "Sesija je gotova",
  byChapter: "Po poglavljima",
  noChapterChange: "Tekst poglavlja nije mijenjan.",
  previous: "Prethodne sesije",
  onlyYou: "Sesije vidite samo Vi.",
  close: "Zatvori",
} as const;
