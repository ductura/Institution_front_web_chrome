import { createElement as h, type ReactNode } from "react";

import { Details, KeyValueList } from "@ductura/ui";

import type { ProcessSummaryV1 } from "../../client/process-summary";
import { countHr } from "../../lib/i18n/hr";
import { messagesHr } from "../../lib/i18n/messages.hr";
import { zagrebEpochMs } from "../../lib/i18n/zagreb";

import styles from "./ProcessSummaryView.module.css";
import { overviewHr as overview } from "./ProcessSummaryView.messages.hr";
import { zagrebParts } from "./zagreb-time";

const t = messagesHr.summary;

export type { ProcessSummaryV1 } from "../../client/process-summary";
type MinuteSpan = ProcessSummaryV1["sessions"]["items"][number];
type Gap = ProcessSummaryV1["gaps"]["items"][number];

export type ProcessSummaryDetails = {
  readonly activeEditingMinutes: number;
  readonly keyEvents: readonly { readonly kind: "import" | "ai-transfer"; readonly at: MinuteSpan }[];
};

/**
 * The process summary (F-10, PRODUCT §7), drawn the same way for everyone who
 * may read it (PRODUCT §5 rule 5, D-80 point 6).
 *
 * Pure: only the server's summary and optional detail fields are input. The
 * same record gives identical markup for student and teacher, independent of
 * the host clock and locale. Times are Europe/Zagreb (`zagreb-time.ts`).
 *
 * Each number stands next to the threshold that decides it (rule 12).
 * Lists keep the server's order. Paste sizes are never added together or
 * compared with the length of the work (§7 "Zabranjeno").
 *
 * Written with `createElement`, not JSX: the unit tests render it with
 * `renderToStaticMarkup`, and the test transform keeps JSX as written
 * (`tsconfig.json` has `jsx: preserve` for Next.js). Text comes from the
 * Croatian catalogues and is checked with the forbidden-terms dictionary.
 */
export type ProcessSummaryViewProps = {
  readonly summary: ProcessSummaryV1;
  readonly details?: ProcessSummaryDetails;
};

type Forms = { readonly one: string; readonly few: string; readonly many: string };

function count(n: number, forms: Forms): string {
  return countHr(n, forms.one, forms.few, forms.many);
}

/** `19. listopada 2026. od 14:05 do 15:20`, or both dates when the day changes. */
function spanText(fromIso: string, toIso: string): string {
  const from = zagrebParts(fromIso);
  const to = zagrebParts(toIso);
  if (!from || !to) return `${fromIso} – ${toIso}`;
  if (from.date === to.date) return `${from.date} ${t.from} ${from.time} ${t.to} ${to.time}`;
  return `${t.from} ${from.date} ${t.at} ${from.time} ${t.to} ${to.date} ${t.at} ${to.time}`;
}

function minuteSpanText(span: MinuteSpan): string {
  return spanText(span.from, span.to);
}

function instantText(iso: string): string {
  const parts = zagrebParts(iso);
  return parts ? `${parts.date} ${t.at} ${parts.time}` : iso;
}

function workPeriod(items: readonly MinuteSpan[]): MinuteSpan | null {
  const first = items[0];
  if (!first) return null;
  let start = first.from;
  let end = first.to;
  for (const span of items) {
    if (span.from < start) start = span.from;
    if (span.to > end) end = span.to;
  }
  return { from: start, to: end };
}

function editingMinutes(items: readonly MinuteSpan[], gaps: readonly Gap[]): number | null {
  const boundaries: { time: number; sessions: number; gaps: number }[] = [];
  for (const item of items) {
    const start = zagrebEpochMs(item.from);
    const end = zagrebEpochMs(item.to);
    if (start === null || end === null || end < start) return null;
    boundaries.push({ time: start, sessions: 1, gaps: 0 }, { time: end, sessions: -1, gaps: 0 });
  }
  for (const gap of gaps) {
    const start = zagrebEpochMs(gap.previousEndedAt);
    const end = zagrebEpochMs(gap.nextStartedAt);
    if (start === null || end === null || end < start) return null;
    boundaries.push({ time: start, sessions: 0, gaps: 1 }, { time: end, sessions: 0, gaps: -1 });
  }

  // An overlap with any recorded gap contributes no time, even if a gap is
  // inside a single session or overlaps another gap.
  let previous = boundaries[0]?.time ?? 0;
  let totalMs = 0;
  let activeSessions = 0;
  let activeGaps = 0;
  for (const boundary of boundaries.sort((a, b) => a.time - b.time)) {
    if (activeGaps === 0) totalMs += activeSessions * (boundary.time - previous);
    previous = boundary.time;
    activeSessions += boundary.sessions;
    activeGaps += boundary.gaps;
  }
  return Math.round(totalMs / 60_000);
}

function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return hours === 0
    ? `${minutes} ${overview.minuteShort}`
    : `${hours} ${overview.hourShort} ${minutes % 60} ${overview.minuteShort}`;
}

function evidenceKind(kind: keyof typeof t.evidenceKinds): ReactNode {
  return h("span", { className: styles.kind }, `${t.evidenceKind}: ${t.evidenceKinds[kind]}`);
}

function threshold(text: string): ReactNode {
  return h("span", { className: styles.threshold }, `(${text})`);
}

function label(text: string): ReactNode {
  return h("span", { className: styles.label }, `${text}:`);
}

function list(items: readonly ReactNode[][], number?: string): ReactNode {
  return h(
    "ol",
    { className: styles.list },
    items.map((children, index) => h("li", { key: index, className: styles.item, "data-number": number }, ...children)),
  );
}

function part(name: string, heading: string, ...children: ReactNode[]): ReactNode {
  return h(
    "section",
    { className: styles.part, "data-part": name },
    h("h3", { className: styles.partTitle }, heading),
    ...children,
  );
}

export function ProcessSummaryView({ summary, details }: ProcessSummaryViewProps) {
  const { sessions, pastes, gaps } = summary;
  const period = workPeriod(sessions.items);
  const minutes = period === null ? null : details?.activeEditingMinutes ?? editingMinutes(sessions.items, gaps.items);
  const transfers = details?.keyEvents.filter(({ kind }) => kind === "ai-transfer");
  const sessionThreshold = `${t.sessions.threshold} ${count(sessions.breakAboveMinutes, t.units.minutesGenitive)}`;
  const listedAbove = `${t.pastes.listedThreshold} ${count(pastes.listedAboveCharacters, t.units.charactersGenitive)}`;

  return h(
    "section",
    { className: styles.summary, "aria-label": t.title },
    h(
      "header",
      { className: styles.head },
      h("h2", { className: styles.title }, t.title),
      h("p", { className: styles.note }, t.sameForEveryone),
    ),
    part(
      "work-period",
      overview.workPeriod.heading,
      period === null
        ? h("p", { className: styles.empty }, overview.workPeriod.unavailable)
        : h(KeyValueList, {
            items: [
              { id: "first", label: overview.workPeriod.first, value: instantText(period.from) },
              { id: "last", label: overview.workPeriod.last, value: instantText(period.to) },
              { id: "kind", label: t.evidenceKind, value: t.evidenceKinds[sessions.evidenceKind] },
            ],
          }),
    ),
    part(
      "sessions",
      t.sessions.heading,
      h(
        "p",
        { className: styles.fact, "data-number": "sessions" },
        label(t.sessions.count),
        ` ${sessions.count} `,
        threshold(sessionThreshold),
        " ",
        evidenceKind(sessions.evidenceKind),
      ),
      sessions.items.length === 0
        ? h("p", { className: styles.empty }, t.sessions.none)
        : h(Details, {
            summary: overview.sessionList,
            className: styles.sessionList,
            children: list(sessions.items.map((span) => [`${minuteSpanText(span)} `, evidenceKind(sessions.evidenceKind)])),
          }),
    ),
    part(
      "editing-duration",
      overview.editingDuration.heading,
      minutes === null
        ? h("p", { className: styles.empty }, overview.editingDuration.unavailable)
        : h(
            "p",
            { className: styles.fact, "data-number": "editing-duration" },
            label(overview.editingDuration.method),
            ` ${durationText(minutes)} `,
            threshold(sessionThreshold),
            " ",
            evidenceKind(sessions.evidenceKind),
          ),
      minutes !== null && gaps.items.length > 0
        ? h("p", { className: styles.explain }, overview.editingDuration.gapNote)
        : null,
      h("p", { className: styles.explain }, overview.editingDuration.note),
    ),
    part(
      "pastes",
      t.pastes.heading,
      pastes.listed.length === 0
        ? h("p", { className: styles.empty }, `${t.pastes.noneListed} `, threshold(listedAbove))
        : list(
            pastes.listed.map((paste) => [
              `${minuteSpanText(paste.at)} · ${t.pastes.size}: ${count(paste.characters, t.units.characters)} `,
              threshold(listedAbove),
              ` · ${t.pastes.origins[paste.origin]} `,
              evidenceKind(pastes.evidenceKind),
            ]),
            "paste",
          ),
      h(
        "p",
        { className: styles.fact, "data-number": "smaller-pastes" },
        label(t.pastes.smaller),
        ` ${pastes.smallerCount} `,
        threshold(`${t.pastes.smallerThreshold} ${count(pastes.listedAboveCharacters, t.units.characters)}`),
        " ",
        evidenceKind(pastes.evidenceKind),
      ),
    ),
    transfers === undefined ? null : part(
      "assistant",
      overview.assistant.heading,
      transfers.length === 0
        ? h("p", { className: styles.empty }, overview.assistant.none)
        : list(transfers.map(({ at }) => [
            `${overview.assistant.transfer} · ${minuteSpanText(at)} `,
            evidenceKind("observed"),
          ])),
    ),
    part(
      "gaps",
      t.gaps.heading,
      h("p", { className: styles.explain }, t.gaps.explanation),
      gaps.items.length === 0
        ? h("p", { className: styles.empty }, t.gaps.none)
        : list(
            gaps.items.map((gap) => [
              `${t.gaps.item}: ${spanText(gap.previousEndedAt, gap.nextStartedAt)} `,
              evidenceKind(gaps.evidenceKind),
            ]),
          ),
    ),
    h(
      "p",
      { className: styles.state, "data-record-state": summary.recordState },
      label(t.recordState.label),
      ` ${t.recordState[summary.recordState]}`,
    ),
    h("p", { className: styles.note }, t.timeNote),
  );
}
