import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary.ts";
import type { SubmissionNote } from "../../../../../../../src/client/submission.ts";
import { countHr } from "../../../../../../../src/lib/i18n/hr.ts";

import { atOf, clockOf, dayOf } from "../steps/time";
import { summaryText as t } from "./messages.hr";

// WEB-2108 (PD-1): the eleven sections of the process summary as text, from
// the server's summary and nothing else. What the summary does not carry
// (versions, AI transfers, the declaration's blocks) is said to be
// unavailable, never invented. Pure, so the student and the teacher get the
// same text for the same record (PRODUCT §5 rule 5).

type Span = { readonly from: string; readonly to: string };
type Forms = { readonly one: string; readonly few: string; readonly many: string };

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
const count = (n: number, forms: Forms) => countHr(n, forms.one, forms.few, forms.many);

/** "28. 10. 2026. u 10:50", Europe/Zagreb as the prototype writes it; the raw text when it cannot be read. */
export function at(iso: string): string {
  return atOf(iso);
}

/** "20. 10. do 5. 11. 2026." (the year once when both ends share it), the prototype's "Do sada" range. */
function range(from: string, to: string): string {
  const a = dayOf(from);
  const b = dayOf(to);
  if (a === null || b === null) return fill(t.period.range, { from, to });
  const shared = a.slice(-5) === b.slice(-5);
  return fill(t.period.range, { from: shared ? a.slice(0, -5).trimEnd() : a, to: b });
}

/** "9:30": the hour without a leading zero, as the prototype's list of sessions has it. */
function hourOf(iso: string): string {
  const clock = clockOf(iso);
  return clock === null ? iso : clock.replace(/^0/, "");
}

/** "28. 10. 2026., 9:30 do 10:50"; both dates when the day changes. */
export function spanText(span: Span): string {
  const from = dayOf(span.from);
  const to = dayOf(span.to);
  if (from === null || to === null) return fill(t.sessions.span, { from: span.from, to: span.to });
  if (from === to) return fill(t.sessions.span, { from: `${from}, ${hourOf(span.from)}`, to: hourOf(span.to) });
  return fill(t.sessions.span, { from: `${from}, ${hourOf(span.from)}`, to: `${to}, ${hourOf(span.to)}` });
}

/** "22. 10. 2026., odsječak oko 10:35": the paste is rounded to the middle of its segment. */
export function pasteWhen(span: Span): string {
  const a = Date.parse(span.from);
  const b = Date.parse(span.to);
  const middle = new Date(Number.isFinite(a) && Number.isFinite(b) ? Math.round((a + b) / 2 / 60_000) * 60_000 : a).toISOString();
  const day = dayOf(middle);
  const clock = clockOf(middle);
  return day === null || clock === null ? span.from : fill(t.pastes.when, { day, clock: clock.replace(/^0/, "") });
}

/** "8 h 05 min", the plain sum of the listed sessions, as the prototype shows it. */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : `${hours} h ${String(rest).padStart(2, "0")} min`;
}

function minutesOf(spans: readonly Span[]): number {
  let total = 0;
  for (const span of spans) {
    const ms = Date.parse(span.to) - Date.parse(span.from);
    if (Number.isFinite(ms) && ms > 0) total += ms;
  }
  return Math.round(total / 60_000);
}

export type PanelContext = { readonly submitted: boolean };

export type Period =
  | { readonly kind: "none"; readonly text: string }
  | { readonly kind: "rows"; readonly rows: readonly { readonly label: string; readonly value: string }[] };

export type PanelSections = {
  readonly intro?: string;
  readonly period: Period;
  readonly sessions: { readonly value: string; readonly meta: string; readonly list: readonly string[] };
  readonly editing: { readonly label: string; readonly value: string };
  readonly pastes: { readonly items: readonly string[]; readonly meta: string };
  readonly gaps: { readonly items: readonly string[]; readonly hint?: string };
  readonly record: { readonly state: string; readonly unchanged?: string };
};

/** Sections 1, 2, 3, 5, 7 and 10 of PD-1 from the summary; the rest need no summary or are unavailable. */
export function panelSections(summary: ProcessSummaryV1, { submitted }: PanelContext): PanelSections {
  const { sessions, pastes, gaps } = summary;
  const items = sessions.items;
  const hasGaps = summary.recordState === "has_gaps";
  const first = items.reduce<string | null>((min, s) => (min === null || s.from < min ? s.from : min), null);
  const last = items.reduce<string | null>((max, s) => (max === null || s.to > max ? s.to : max), null);
  const period: Period = first === null || last === null
    ? { kind: "none", text: t.period.none }
    : submitted
      ? { kind: "rows", rows: [{ label: t.period.first, value: at(first) }, { label: t.period.last, value: at(last) }] }
      : { kind: "rows", rows: [{ label: t.period.soFar, value: range(first, last) }] };
  return {
    intro: submitted ? undefined : t.beforeSubmit,
    period,
    sessions: {
      value: count(sessions.count, t.sessions.forms),
      meta: fill(t.sessions.meta, { n: sessions.breakAboveMinutes }) + (hasGaps ? t.sessions.gapNotCounted : ""),
      list: items.map(spanText),
    },
    editing: {
      label: fill(t.editing.label, { n: count(sessions.count, t.editing.forms) }),
      value: durationText(minutesOf(items)),
    },
    pastes: {
      items: pastes.listed.map((p) => fill(t.pastes.item, { at: pasteWhen(p.at), n: count(p.characters, t.pastes.forms) })),
      meta: fill(t.pastes.meta, { n: pastes.listedAboveCharacters }),
    },
    gaps: {
      items: gaps.items.map((g) => fill(t.gaps.item, { from: at(g.previousEndedAt), to: at(g.nextStartedAt) })),
      hint: hasGaps && !submitted ? t.gaps.noteHint : undefined,
    },
    record: { state: hasGaps ? t.record.hasGaps : t.record.complete, unchanged: submitted ? t.record.unchanged : undefined },
  };
}

/** "Text · 1. studenoga 2026. u 11:00", a note as section 9 lists it. */
export function noteText(note: SubmissionNote): string {
  return fill(t.notes.item, { text: note.text, at: at(note.createdAt) });
}
