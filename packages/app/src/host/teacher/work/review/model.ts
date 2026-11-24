// Pure rules of "Pregled rada" (WEB-NUZ-PG; NF-5 PG-1, PG-4, PG-10). No network call here.
// A fact the server does not give is left out or said as unavailable, never invented (B-6).
import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import { kindLabel } from "../../provenance/origin-model";
import type { MatchRead } from "../../provenance/match-model";
import { percentText } from "../../provenance/origin-model";
import { isSubmitted, stateLine, type Facts } from "../../n06/model";
import type { ThresholdRow } from "../../n10/model";
import { reviewMessages as t } from "./messages.hr";

/** The view tabs, in the order of the prototype (`pregled`, PG_TABS). */
export const TAB_IDS = ["tekst", "sazetak", "podrijetlo", "reprodukcija", "usporedba", "izjava"] as const;
export type TabId = (typeof TAB_IDS)[number];
export const DEFAULT_TAB: TabId = "tekst";
export const TAB_PARAM = "kartica";

const isTab = (value: string | null): value is TabId => value !== null && (TAB_IDS as readonly string[]).includes(value);

/** The tab named in the address (`?kartica=…`); the text tab for anything else. */
export function tabOf(search: string): TabId {
  const value = new URLSearchParams(search).get(TAB_PARAM);
  return isTab(value) ? value : DEFAULT_TAB;
}

/** `/nastavnik/rad/{id}/pregled?kartica=…`: previous and next work keep the open tab (PG-1). */
export function reviewPath(workPath: string, tab: TabId): string {
  return tab === DEFAULT_TAB ? `${workPath}/pregled` : `${workPath}/pregled?${TAB_PARAM}=${tab}`;
}

export const WORK_TYPES = {
  short_paper: "Kratki rad",
  essay: "Esej",
  seminar_paper: "Seminarski rad",
  bachelor_thesis: "Završni rad",
  master_thesis: "Diplomski rad",
  specialist_thesis: "Specijalistički rad",
  doctoral_thesis: "Doktorski rad",
} as const;
export type WorkType = keyof typeof WORK_TYPES;

/** The assignment around the work, from teacher.courses.get; null when that read failed or does not list it. */
export type Context = {
  readonly course: string;
  readonly title: string;
  readonly workType: WorkType;
  readonly dueAt: string;
};

/** teacher.assignment-grade.get: eligible, a practice assignment (409), or not known. */
export type Grade = "eligible" | "practice" | "unknown";

export type Header = { readonly facts: Facts; readonly context: Context | null; readonly grade: Grade };

/** „Kolegij A · zadatak „Naslov” · probni zadatak”. */
export function contextLine(h: Header): string {
  const parts = h.context === null ? [t.courseUnavailable, t.titleUnavailable] : [h.context.course, t.task(h.context.title)];
  return [...parts, ...(h.grade === "practice" ? [t.practice] : [])].join(" · ");
}

/** „Student A · Seminarski rad „Naslov””, or „Student A · Rad” without the assignment. */
export function headingOf(h: Header): string {
  const student = h.facts.studentName ?? t.noName;
  return h.context === null ? t.heading(student, t.workKind, null) : t.heading(student, WORK_TYPES[h.context.workType], h.context.title);
}

/** The N-06 state line, with the deadline of the assignment when the receipt does not already name it. */
export function stateOf(h: Header): string {
  const line = stateLine(h.facts);
  if (h.facts.receipt !== null && isSubmitted(h.facts)) return line;
  return `${line} · ${h.context === null ? t.dueUnavailable : t.due(formatDateTimeHr(h.context.dueAt))}`;
}

/** PG-10: the grade stays in Merlin; a practice assignment is not graded or exported. */
export function gradeNote(grade: Grade): { readonly strong: string; readonly note: string } {
  return grade === "practice" ? { strong: t.gradePractice, note: t.gradePracticeNote } : { strong: t.gradeMerlin, note: t.gradeMerlinNote };
}

/** „Natrag na zadatak” goes to the submissions of the assignment (N-04/PIL-D2), not only to the course list. */
export const taskPath = (assignmentId: string): string => `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/predaje`;

// ---- PG-4: one part of the summary; "not given" is not an error ----

/**
 * One part of the summary. `notGiven`: the server does not give this part for this work (404, 403); a retry
 * cannot help, so there is no button. `error`: the read failed (503, network); the part says so and offers a retry.
 */
export type Part<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly value: T }
  | { readonly kind: "notGiven" }
  | { readonly kind: "error" }
  | { readonly kind: "signedOut" };

export type Outcome<T> = { readonly kind: "ok"; readonly value: T } | { readonly kind: "notFound" | "unavailable" | "signedOut" };

export function partOf<T>(outcome: Outcome<T>): Part<T> {
  switch (outcome.kind) {
    case "ok": return { kind: "ready", value: outcome.value };
    case "notFound": return { kind: "notGiven" };
    case "signedOut": return { kind: "signedOut" };
    default: return { kind: "error" };
  }
}

/** The match read of the provenance map as a part: "none" is a ready answer with no finding. */
export function matchPart(read: MatchRead): Part<{ readonly percent: number; readonly findings: number; readonly conversations: number }> {
  switch (read.kind) {
    case "none": return { kind: "ready", value: { percent: 0, findings: 0, conversations: 0 } };
    case "ready": return { kind: "ready", value: {
      percent: read.percent, findings: read.findings.length,
      conversations: new Set(read.findings.map((f) => f.conversationId)).size,
    } };
    case "notFound": return { kind: "notGiven" };
    case "signedOut": return { kind: "signedOut" };
    default: return { kind: "error" };
  }
}

/** „Udio teksta koji se podudara: 4 % · nije dokaz autorstva”; null without a share. */
export function matchShareLine(percent: number): string | null {
  if (percent <= 0) return null;
  return `${t.matchShare(percentText({ percent: Math.round(percent), codePoints: 1 }))} · ${t.notProof}`;
}

/** „Uvezeno iz datoteke: za pregled”, in the closed order of the server rows. */
export const ruleLines = (rows: readonly ThresholdRow[]): readonly string[] =>
  rows.map((row) => `${kindLabel(row.origin)}: ${t.ruleState[row.state]}`);

/** The rhythm line: recorded bursts, or the usual state once it is gone or was never recorded. */
export const rhythmLine = (bursts: number): string => (bursts > 0 ? t.rhythmRecorded(bursts) : t.rhythmGone);
