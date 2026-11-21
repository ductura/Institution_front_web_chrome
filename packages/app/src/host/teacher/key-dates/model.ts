// Pure rules of the key-dates card in mentoring (WEB-1707; plan M6.11). A closed list of kinds, sorted by
// date, shown in Europe/Zagreb time; nothing is counted or timed. No server route exists yet: the port is the
// smallest contract the plan implies (a probe answer stands in for it in the tests). No network call here.
import { zagrebWall } from "../../../../../../src/components/i18n/zagreb.ts";
import { keyDatesMessages as text } from "./messages.hr";

export const KINDS = ["opens", "deadline", "extended", "review"] as const;
export type KeyDateKind = (typeof KINDS)[number];

export type KeyDateEntry = { readonly id: string; readonly kind: KeyDateKind; /** ISO instant. */ readonly at: string };

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

const LABELS: Readonly<Record<KeyDateKind, string>> = {
  opens: text.kindOpens,
  deadline: text.kindDeadline,
  extended: text.kindExtended,
  review: text.kindReview,
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** The date as the interface reads it, Zagreb wall clock. */
export function whenOf(epoch: number): string {
  const w = zagrebWall(epoch);
  return text.at(w.day, w.month, w.year, `${pad2(w.hour)}:${pad2(w.minute)}`);
}

/** Rows sorted by date (ties by the closed order of kinds, then id); an unreadable or repeated entry is left out. */
export function keyDatesView(read: KeyDatesRead): KeyDatesView {
  if (read.kind !== "ready") return { kind: read.kind };
  const seen = new Set<string>();
  const rows: KeyDateRow[] = [];
  for (const d of read.dates) {
    const epoch = Date.parse(d.at);
    if (!Number.isFinite(epoch) || !KINDS.includes(d.kind) || seen.has(d.id)) continue;
    seen.add(d.id);
    rows.push({ id: d.id, kind: d.kind, label: LABELS[d.kind], epoch, when: whenOf(epoch) });
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
