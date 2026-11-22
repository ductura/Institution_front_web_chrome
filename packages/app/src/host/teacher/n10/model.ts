// Pure rules of N-10 "Sažetak procesa" (WEB-2157; INVENTAR-nastavnik 3.9, PARITET N-10 br. 17). Only what the
// server states is shown: no sum of paste sizes, no share, no comparison with the length of the work. A part the
// server does not give is `null` and the screen says it is not available. No network call here.
import { countHr } from "../../../../../../src/lib/i18n/hr";
import { zagrebEpochMs, zagrebWall } from "../../../../../../src/lib/i18n/zagreb";
import type { ApiResult } from "../../../../../../src/client/api";
import type { ProcessSummaryV1, SummaryOutcome } from "../../../../../../src/client/process-summary";
import { ORIGIN_KINDS, type OriginKind } from "../origin-map/contract";
import { n10Messages as text } from "./messages.hr";

export type Span = { readonly from: string; readonly to: string };
type DetailsBody = Extract<ApiResult<"projection.process-summary-details.post">, { ok: true }>["body"];
/** An import or a transfer from the AI assistant, as the contract names it. */
export type KeyEvent = { readonly kind: DetailsBody["keyEvents"][number]["kind"]; readonly at: Span };
export type SummaryDetails = { readonly activeEditingMinutes: number; readonly keyEvents: readonly KeyEvent[] };
export type DetailsOutcome = { readonly kind: "ok"; readonly details: SummaryDetails } | { readonly kind: "signedOut" | "notFound" | "unavailable" };
export type N10Version = { readonly kind: "checkpoint" | "submission"; readonly revision: number; readonly savedMinute: string };
export type VersionsOutcome = { readonly kind: "ready"; readonly versions: readonly N10Version[] } | { readonly kind: "signedOut" | "unavailable" };
/** P-1 rule 12: the server states only one of three labels per origin kind, never the threshold or a score. */
export type ThresholdState = "in_line" | "for_review" | "exceeded";
export type ThresholdRow = { readonly origin: OriginKind; readonly state: ThresholdState };
export type ThresholdsOutcome = { readonly kind: "ok"; readonly rows: readonly ThresholdRow[] } | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export interface N10Port {
  summary(documentId: string): Promise<SummaryOutcome>;
  details(documentId: string): Promise<DetailsOutcome>;
  versions(documentId: string): Promise<VersionsOutcome>;
  /** work.origin-thresholds.get; a port without it shows no faculty rules. */
  thresholds?(documentId: string): Promise<ThresholdsOutcome>;
}

export type N10Read =
  | { readonly kind: "ready"; readonly summary: ProcessSummaryV1; readonly details: SummaryDetails | null; readonly versions: readonly N10Version[] | null; readonly thresholds?: readonly ThresholdRow[] }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

/** A summary with nothing recorded: no session, no paste, no gap. */
export const isEmpty = (s: ProcessSummaryV1): boolean =>
  s.sessions.count === 0 && s.pastes.listed.length === 0 && s.pastes.smallerCount === 0 && s.gaps.items.length === 0;

/**
 * The summary is required; the details and the versions only add sections. A details answer for another
 * summary (its summary differs) is dropped, so two reads never mix into one screen.
 */
export async function loadSummary(port: N10Port, documentId: string): Promise<N10Read> {
  const [summary, details, versions, thresholds] = await Promise.all([
    safe(() => port.summary(documentId), { kind: "unavailable" } as SummaryOutcome),
    safe(() => port.details(documentId), { kind: "unavailable" } as DetailsOutcome),
    safe(() => port.versions(documentId), { kind: "unavailable" } as VersionsOutcome),
    safe(async () => (port.thresholds === undefined ? NO_THRESHOLDS : port.thresholds(documentId)), NO_THRESHOLDS),
  ]);
  if (summary.kind !== "ok") return { kind: summary.kind };
  if (isEmpty(summary.summary)) return { kind: "empty" };
  return {
    kind: "ready",
    summary: summary.summary,
    details: details.kind === "ok" ? details.details : null,
    versions: versions.kind === "ready" ? versions.versions : null,
    ...(thresholds.kind === "ok" && thresholds.rows.length > 0 ? { thresholds: thresholds.rows } : {}),
  };
}

const NO_THRESHOLDS: ThresholdsOutcome = { kind: "ok", rows: [] };

/**
 * The comparison in the order of the closed list of origin kinds, so the screen never sorts kinds by their state.
 * An answer naming a kind twice is not usable (`null`), so two states of one kind never reach the screen.
 */
export function thresholdRows(comparison: readonly ThresholdRow[]): readonly ThresholdRow[] | null {
  const origins = comparison.map((row) => row.origin);
  if (new Set(origins).size !== origins.length) return null;
  return [...comparison]
    .sort((a, b) => ORIGIN_KINDS.indexOf(a.origin) - ORIGIN_KINDS.indexOf(b.origin))
    .map(({ origin, state }) => ({ origin, state }));
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

function wall(iso: string): { date: string; time: string } | null {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return null;
  const w = zagrebWall(ms);
  return { date: `${w.day}. ${w.month}. ${w.year}.`, time: `${w.hour}:${pad2(w.minute)}` };
}

/** `20. 10. 2026. u 18:05` (prototype form). */
export function at(iso: string): string {
  const w = wall(iso);
  return w === null ? iso : `${w.date} u ${w.time}`;
}

/** `20. 10. 2026., 18:05 do 19:40`; both dates when the day changes. */
export function sessionLine(span: Span): string {
  const from = wall(span.from), to = wall(span.to);
  if (from === null || to === null) return `${span.from} – ${span.to}`;
  return from.date === to.date ? `${from.date}, ${from.time} do ${to.time}` : `${from.date}, ${from.time} do ${to.date}, ${to.time}`;
}

/** `22. 10. 2026., odsječak oko 10:35`; a segment spanning minutes is given as its range. */
export function segmentLine(span: Span): string {
  const from = wall(span.from), to = wall(span.to);
  if (from === null || to === null) return `${span.from} – ${span.to}`;
  if (from.date === to.date && from.time === to.time) return `${from.date}, odsječak oko ${from.time}`;
  return from.date === to.date ? `${from.date}, odsječak od ${from.time} do ${to.time}` : `${from.date}, odsječak od ${from.time} do ${to.date}, ${to.time}`;
}

/** First and last recorded event: the earliest start and the latest end of the sessions. */
export function period(items: readonly Span[]): Span | null {
  if (items.length === 0) return null;
  let from = items[0]!.from, to = items[0]!.to;
  for (const s of items) {
    if (s.from < from) from = s.from;
    if (s.to > to) to = s.to;
  }
  return { from, to };
}

export const sessionsCount = (n: number): string => countHr(n, "sesija", "sesije", "sesija");
export const sessionsGenitive = (n: number): string => countHr(n, "sesije", "sesije", "sesija");
export const minutesGenitive = (n: number): string => countHr(n, "minute", "minute", "minuta");
export const characters = (n: number): string => countHr(n, "znak", "znaka", "znakova");
export const charactersGenitive = (n: number): string => countHr(n, "znaka", "znaka", "znakova");

/** `8 h 05 min`, `45 min`. */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${pad2(m)} min`;
}

export type VersionLine = { readonly revision: number; readonly line: string };

/**
 * Submitted versions, oldest first. As on N-11 (WEB-2160), the newest submission is the submitted work and
 * every older one was sent for review; checkpoints are not versions here.
 */
export function versionLines(versions: readonly N10Version[]): readonly VersionLine[] {
  const byRevision = new Map<number, N10Version>();
  for (const v of versions) if (v.kind === "submission") byRevision.set(v.revision, v);
  const sorted = [...byRevision.values()].sort((a, b) => a.revision - b.revision);
  return sorted.map((v, i) => ({
    revision: v.revision,
    line: `${at(v.savedMinute)} · ${i === sorted.length - 1 ? text.versionSubmitted : text.versionSent}`,
  }));
}

/** Transfers from the AI assistant, in the server's order. */
export const assistantTransfers = (details: SummaryDetails): readonly Span[] =>
  details.keyEvents.filter((e) => e.kind === "ai-transfer").map((e) => e.at);

/** Anchors in the origin map (N-10 br. 18) that "Prikaži mjesto u radu" jumps to. */
export const pasteAnchor = (index: number): string => `pv-paste-${index + 1}`;
export const assistantAnchor = (index: number): string => `pv-ai-${index + 1}`;
