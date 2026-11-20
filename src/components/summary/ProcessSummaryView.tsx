import { createElement as h, type ReactNode } from "react";

import { Details } from "@ductura/ui";

import type { ProcessSummaryV1 } from "../../client/process-summary";
import { countHr } from "../../lib/i18n/hr";
import { messagesHr } from "../../lib/i18n/messages.hr";
import { zagrebEpochMs } from "../../lib/i18n/zagreb";

import styles from "./ProcessSummaryView.module.css";
import { zagrebParts } from "./zagreb-time";

const t = messagesHr.summary;

export type { ProcessSummaryV1 } from "../../client/process-summary";
type MinuteSpan = ProcessSummaryV1["sessions"]["items"][number];

/**
 * The process summary (F-10, PRODUCT §7), drawn the same way for everyone who
 * may read it (PRODUCT §5 rule 5, D-80 point 6).
 *
 * Pure: the only input is the summary the server returned. There is no input
 * about who reads it, no hook, no generated id and no host clock, time zone or
 * language, so the same summary gives the same markup for the student and the
 * teacher. Times are Europe/Zagreb (`zagreb-time.ts`).
 *
 * Each number stands next to the threshold that decides it (rule 12).
 * Lists keep the server's order. Paste sizes are never added together or
 * compared with the length of the work (§7 "Zabranjeno").
 *
 * Written with `createElement`, not JSX: the unit tests render it with
 * `renderToStaticMarkup`, and the test transform keeps JSX as written
 * (`tsconfig.json` has `jsx: preserve` for Next.js). All text comes from
 * `messages.hr.ts`, which the forbidden-terms scan reads.
 */
export type ProcessSummaryViewProps = {
  readonly summary: ProcessSummaryV1;
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

function workPeriod(items: readonly MinuteSpan[]): string | null {
  const first = items[0];
  if (!first) return null;
  let start = first.from;
  let end = first.to;
  for (const span of items) {
    if (span.from < start) start = span.from;
    if (span.to > end) end = span.to;
  }
  const from = zagrebParts(start)?.date;
  const to = zagrebParts(end)?.date;
  if (!from || !to) return null;
  return from === to ? from : `${from} – ${to}`;
}

function editingDuration(items: readonly MinuteSpan[]): string | null {
  if (items.length === 0) return null;
  let totalMs = 0;
  for (const { from, to } of items) {
    const start = zagrebEpochMs(from);
    const end = zagrebEpochMs(to);
    if (start === null || end === null || end < start) return null;
    totalMs += end - start;
  }
  const minutes = Math.round(totalMs / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours === 0
    ? `${minutes} ${t.units.minuteShort}`
    : `${hours} ${t.units.hourShort} ${minutes % 60} ${t.units.minuteShort}`;
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

export function ProcessSummaryView({ summary }: ProcessSummaryViewProps) {
  const { sessions, pastes, gaps } = summary;
  const period = workPeriod(sessions.items);
  const duration = editingDuration(sessions.items);
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
      t.workPeriod.heading,
      period === null
        ? h("p", { className: styles.empty }, t.workPeriod.unavailable)
        : h("p", { className: styles.fact }, period, " · ", evidenceKind(sessions.evidenceKind)),
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
            summary: t.sessions.list,
            className: styles.sessionList,
            children: list(sessions.items.map((span) => [`${minuteSpanText(span)} `, evidenceKind(sessions.evidenceKind)])),
          }),
    ),
    part(
      "editing-duration",
      t.editingDuration.heading,
      duration === null
        ? h("p", { className: styles.empty }, t.editingDuration.unavailable)
        : h(
            "p",
            { className: styles.fact, "data-number": "editing-duration" },
            label(t.editingDuration.method),
            ` ${duration} `,
            threshold(sessionThreshold),
            " ",
            evidenceKind(sessions.evidenceKind),
          ),
      h("p", { className: styles.explain }, t.editingDuration.note),
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
