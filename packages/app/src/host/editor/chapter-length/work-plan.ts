// F4-PM2-R19 (M5.15): the work planner. From the days left to the deadline and the
// words each chapter still lacks to its minimum, it tells how many words a day
// the student needs. Pure; the deadline and the targets come from the page, and
// nothing is invented: no deadline or no minimum means no plan, said honestly.
import type { WordRange } from "@ductura/ui";

import { dailyPace } from "../assist/deadlines";

export type PlanChapter = { readonly id: string; readonly label: string; readonly words: number; readonly target?: WordRange };
export type PlanRow = { readonly id: string; readonly label: string; readonly words: number; readonly remaining: number; readonly over: boolean };
export type WorkPlan =
  | { readonly state: "noGoals" }
  | { readonly state: "noDeadline"; readonly rows: readonly PlanRow[]; readonly remaining: number }
  | { readonly state: "done"; readonly rows: readonly PlanRow[]; readonly remaining: 0 }
  | { readonly state: "late"; readonly rows: readonly PlanRow[]; readonly remaining: number; readonly daysLate: number }
  | { readonly state: "plan"; readonly rows: readonly PlanRow[]; readonly remaining: number; readonly days: number; readonly perDay: number };

/** Words still missing to the chapter's minimum (0 without a minimum), and whether it passes its maximum. */
export function chapterGap(words: number, target: WordRange | undefined): { remaining: number; over: boolean } {
  const min = target?.min ?? null;
  const max = target?.max ?? null;
  return { remaining: min === null ? 0 : Math.max(0, min - words), over: max !== null && words > max };
}

/** `daysLeft`: whole days to the deadline (negative once it has passed), or null when the work has none. */
export function planWork(chapters: readonly PlanChapter[], daysLeft: number | null): WorkPlan {
  const goals = chapters.filter((c) => c.target && (c.target.min !== null || c.target.max !== null));
  if (goals.length === 0) return { state: "noGoals" };
  const rows = goals.map((c): PlanRow => ({ id: c.id, label: c.label, words: c.words, ...chapterGap(c.words, c.target) }));
  const remaining = rows.reduce((sum, r) => sum + r.remaining, 0);
  if (remaining === 0) return { state: "done", rows, remaining: 0 };
  if (daysLeft === null || !Number.isFinite(daysLeft)) return { state: "noDeadline", rows, remaining };
  if (daysLeft < 0) return { state: "late", rows, remaining, daysLate: -daysLeft };
  // The day of the deadline still counts as a writing day.
  const days = daysLeft + 1;
  return { state: "plan", rows, remaining, days, perDay: dailyPace(remaining, days) };
}
