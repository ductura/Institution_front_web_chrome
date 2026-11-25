// Pure rules of the key-dates card in mentoring (WEB-1707; plan M6.11). A closed list of kinds, sorted by
// date, shown in Europe/Zagreb time; nothing is counted or timed. The kinds are those of the server route
// mentorship.key-dates.get (SRV-1705); the real port is in contract.ts. No network call here.
import { zagrebWall } from "../../../../../../src/components/i18n/zagreb.ts";
import { keyDatesMessages as text } from "./messages.hr";

export const KINDS = ["deadline", "milestone", "consultation"] as const;
export type KeyDateKind = (typeof KINDS)[number];
export const CONSULTATION_STATES = ["requested", "countered", "confirmed"] as const;
export type ConsultationState = (typeof CONSULTATION_STATES)[number];

/** One date as the server gives it; `at` is an ISO instant. */
export type KeyDateEntry =
  | { readonly id: string; readonly kind: "deadline"; readonly at: string }
  | { readonly id: string; readonly kind: "milestone"; readonly at: string; readonly title: string }
  | { readonly id: string; readonly kind: "consultation"; readonly at: string; readonly state: ConsultationState };

export type KeyDatesRead =
  | { readonly kind: "ready"; readonly dates: readonly KeyDateEntry[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface KeyDatesPort {
  read(mentorshipId: string): Promise<KeyDatesRead>;
}

export type KeyDateRow = { readonly id: string; readonly kind: KeyDateKind; readonly label: string; readonly epoch: number; readonly when: string };

export type KeyDatesView =
  | { readonly kind: "ready"; readonly rows: readonly KeyDateRow[] }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const CONSULTATION: Readonly<Record<ConsultationState, string>> = {
  requested: text.consultationRequested,
  countered: text.consultationCountered,
  confirmed: text.consultationConfirmed,
};

/** The label of a known entry, or null for a kind or state outside the closed lists. */
function labelOf(d: KeyDateEntry): string | null {
  if (d.kind === "deadline") return text.kindDeadline;
  if (d.kind === "milestone") return typeof d.title === "string" && d.title.trim() !== "" ? text.kindMilestone(d.title.trim()) : null;
  if (d.kind === "consultation") return CONSULTATION_STATES.includes(d.state) ? text.kindConsultation(CONSULTATION[d.state]) : null;
  return null;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** The date as the interface reads it, Zagreb wall clock. */
export function whenOf(epoch: number): string {
  const w = zagrebWall(epoch);
  return text.at(w.day, w.month, w.year, `${pad2(w.hour)}:${pad2(w.minute)}`);
}

/** Whole Zagreb calendar days from `now` to `epoch`: 0 the same day, 1 tomorrow, -1 yesterday (MK-13). */
export function dayDiff(epoch: number, now: number): number {
  const day = (ms: number): number => { const w = zagrebWall(ms); return Date.UTC(w.year, w.month - 1, w.day) / 86_400_000; };
  return day(epoch) - day(now);
}

/** "danas", "za n dan(a)" or "prije n dan(a)" by Zagreb calendar day (MK-13). */
export function relativeDays(epoch: number, now: number): string {
  const n = dayDiff(epoch, now);
  if (n === 0) return text.today;
  const abs = Math.abs(n);
  return (n > 0 ? text.inDays : text.daysAgo)(abs, abs % 10 === 1 && abs % 100 !== 11 ? text.dayOne : text.dayMany);
}

export type TimelineRow = KeyDateRow & { readonly relative: string };
/** MK-13: one timeline for the mentor and the student; what is past, then today, then what is ahead. */
export type Timeline = { readonly past: readonly TimelineRow[]; readonly today: string; readonly ahead: readonly TimelineRow[] };

/** Splits sorted rows at today (Zagreb): a date of today is ahead, so it is never shown as missed. */
export function timelineOf(rows: readonly KeyDateRow[], now: number): Timeline {
  const marked = rows.map((r) => ({ ...r, relative: relativeDays(r.epoch, now) }));
  const w = zagrebWall(now);
  return {
    past: marked.filter((r) => dayDiff(r.epoch, now) < 0),
    today: text.todayIs(w.day, w.month, w.year),
    ahead: marked.filter((r) => dayDiff(r.epoch, now) >= 0),
  };
}

/** Rows sorted by date (ties by the closed order of kinds, then id); an unreadable or repeated entry is left out. */
export function keyDatesView(read: KeyDatesRead): KeyDatesView {
  if (read.kind !== "ready") return { kind: read.kind };
  const seen = new Set<string>();
  const rows: KeyDateRow[] = [];
  for (const d of read.dates) {
    const epoch = Date.parse(d.at);
    const label = KINDS.includes(d.kind) ? labelOf(d) : null;
    const key = `${d.kind}:${d.id}`;
    if (!Number.isFinite(epoch) || label === null || seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: d.id, kind: d.kind, label, epoch, when: whenOf(epoch) });
  }
  rows.sort((a, b) => a.epoch - b.epoch || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows.length === 0 ? { kind: "empty" } : { kind: "ready", rows };
}

/** Reads through the port; a failure is "unavailable", never a made-up value. */
export async function loadKeyDates(port: KeyDatesPort, mentorshipId: string): Promise<KeyDatesView> {
  try {
    return keyDatesView(await port.read(mentorshipId));
  } catch {
    return { kind: "unavailable" };
  }
}
