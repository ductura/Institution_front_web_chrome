// WEB-2128: "Ravnoteža poglavlja" and "Predloži raspodjelu opsega" (plus.js).
import { assistHr as t } from "./messages.hr";
import { ownAndSub, type AssistChapter } from "./blocks";
import { roleOf, type Roles } from "./advice";
import type { RoleKey } from "./messages.hr";

export type WorkRange = { readonly min: number | null; readonly max: number | null };
export type Targets = Readonly<Record<string, number>>;

const SHARE: Partial<Record<RoleKey, number>> = { uvod: 0.09, zakljucak: 0.07, teorija: 0.2, metodologija: 0.1, rasprava: 0.14 };
const REST_FLOOR = 0.2;

/**
 * Goals per top chapter, from the middle of the range of the work: introduction
 * about a tenth, conclusion less, the other roles share the rest (at least a
 * fifth of the work). Rounded to 50 words, never under 100.
 */
export function distribute(chapters: readonly AssistChapter[], roles: Roles, range: WorkRange): Targets | null {
  if (range.min === null || range.max === null) return null;
  const top = chapters.filter((c) => c.parentId === null);
  if (top.length === 0) return null;
  const total = (range.min + range.max) / 2;
  const roleList = top.map((c) => roleOf(chapters, c.id, roles));
  const fixed = roleList.reduce((sum, role) => sum + (SHARE[role] ?? 0), 0);
  const free = roleList.filter((role) => SHARE[role] === undefined).length;
  const rest = free === 0 ? 0 : Math.max(REST_FLOOR, 1 - fixed) / free;
  const targets: Record<string, number> = {};
  top.forEach((c, i) => {
    const share = SHARE[roleList[i]!] ?? rest;
    targets[c.id] = Math.max(100, Math.round((total * share) / 50) * 50);
  });
  return targets;
}

export type BalanceStatus = { readonly kind: "over" | "under" | "ok" | "unknown"; readonly words: number; readonly by: number };

export function workStatus(words: number, range: WorkRange): BalanceStatus {
  if (range.max !== null && words > range.max) return { kind: "over", words, by: words - range.max };
  if (range.min !== null && words < range.min) return { kind: "under", words, by: range.min - words };
  return { kind: range.min === null && range.max === null ? "unknown" : "ok", words, by: 0 };
}

export function statusText(status: BalanceStatus): string {
  if (status.kind === "over") return t.balance.over(status.by);
  if (status.kind === "under") return t.balance.under(status.by);
  return status.kind === "ok" ? t.balance.ok : t.balance.noRange;
}

export type BalanceRow = {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly words: number;
  readonly goal: number | null;
  readonly over: boolean;
  /** Share of the bar filled, 0..100; the goal marker sits at `marker`. */
  readonly fill: number;
  readonly marker: number | null;
  readonly text: string;
};

export function balanceRows(chapters: readonly AssistChapter[], targets: Readonly<Record<string, number | undefined>>): BalanceRow[] {
  return chapters.filter((c) => c.parentId === null).map((c) => {
    const words = ownAndSub(chapters, c.id).words;
    const goal = targets[c.id] ?? null;
    if (goal === null) return { id: c.id, number: c.number, title: c.title, words, goal, over: false, fill: 0, marker: null, text: `${words}` };
    const over = words > goal * 1.1;
    const scale = Math.max(words, goal * 1.25, 1);
    const state = words > goal ? t.balance.aboveGoal(words - goal) : words < goal ? t.balance.missingGoal(goal - words) : "";
    return { id: c.id, number: c.number, title: c.title, words, goal, over, fill: Math.round((words / scale) * 100), marker: Math.round((goal / scale) * 100), text: t.balance.row(words, goal, state) };
  });
}
