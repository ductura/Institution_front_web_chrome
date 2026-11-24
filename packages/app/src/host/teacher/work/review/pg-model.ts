// Pure rules of NF-5 PG-3, PG-5, PG-7 and PG-9 in "Pregled rada". No network call here. A fact the server does not
// give is said as unavailable, never invented (B-6). No row is ranked or counted by size; the order is the server's.
import type { CommentThread } from "../../../../../../../src/client/comments";
import type { DisputeKind, EventDispute } from "../../../../../../../src/client/event-disputes";
import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary";
import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import type { WorkComment } from "../../comment-bank/model";
import type { SummaryDetails } from "../../n10/model";
import type { OriginComposition, OriginKind } from "../../provenance/origin";
import { kindLabel, percentText } from "../../provenance/origin-model";
import { pgMessages as t } from "./pg-messages.hr";

// ---- PG-3 ----

export type CompositionRow = {
  readonly kind: OriginKind; readonly label: string; readonly share: string; readonly means: string; readonly notMeans: string;
};

/** One row per kind with a share, in the closed order of the server rows; the inserted and the matched text are two rows. */
export function compositionRows(c: OriginComposition): readonly CompositionRow[] {
  return c.shares.filter((s) => s.codePoints > 0).map((s) => ({
    kind: s.kind, label: kindLabel(s.kind), share: `${percentText(s)} · ${t.notProof}`, means: t.means[s.kind], notMeans: t.notMeans[s.kind],
  }));
}

/** Pasted text of unknown origin asks for an explanation, not a sanction. */
export const hasUnknown = (c: OriginComposition): boolean => c.shares.some((s) => s.kind === "pasted_unknown" && s.codePoints > 0);

// ---- PG-5 ----

export type Place = { readonly key: string; readonly at: string; readonly when: string; readonly what: string };

const minute = (iso: string): string => formatDateTimeHr(iso);

/** The important places of the record, from what the summary and its details state: pastes, transfers, imports, gaps; in time order. */
export function importantPlaces(summary: ProcessSummaryV1, details: SummaryDetails | null): readonly Place[] {
  const places: Place[] = [
    ...summary.pastes.listed.map((p, i) => ({ key: `paste:${i}`, at: p.at.from, when: minute(p.at.from), what: t.paste(p.characters) })),
    ...summary.gaps.items.map((g, i) => ({
      key: `gap:${i}`, at: g.previousEndedAt, when: t.gapRange(minute(g.previousEndedAt), minute(g.nextStartedAt)), what: t.gap,
    })),
    ...(details?.keyEvents ?? []).map((e, i) => ({
      key: `event:${i}`, at: e.at.from, when: minute(e.at.from), what: e.kind === "ai-transfer" ? t.transfer : t.importFile,
    })),
  ];
  return places.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.key.localeCompare(b.key)));
}

// ---- PG-7 ----

export type NoteRow = { readonly key: string; readonly head: string; readonly text: string };

const NOTE_KIND: Record<DisputeKind, string> = { supplement: t.noteSupplement, dispute: t.noteDispute };

/** The student's notes in the order the server gave them. */
export const noteRows = (disputes: readonly EventDispute[]): readonly NoteRow[] =>
  disputes.map((d) => ({ key: d.id, head: t.noteBy(NOTE_KIND[d.kind], formatDateTimeHr(d.createdWindow)), text: d.text }));

// ---- PG-9 ----

export type GivenRow = { readonly key: string; readonly at: string; readonly when: string; readonly what: string; readonly who: string; readonly state: "published" | "draft"; readonly deleted: boolean };

/** Published comments of the threads and unpublished drafts, oldest first; a draft is marked „nije objavljeno”. */
export function givenRows(threads: readonly CommentThread[], drafts: readonly WorkComment[]): readonly GivenRow[] {
  const published: GivenRow[] = threads.flatMap((thread) => thread.comments.map((c) => ({
    key: `c:${c.id}`, at: c.createdWindow, when: formatDateTimeHr(c.createdWindow), what: c.body ?? t.deleted,
    who: c.role === "teacher" ? t.givenOwn : t.givenStudent, state: "published" as const, deleted: c.body === null,
  })));
  const unpublished: GivenRow[] = drafts.filter((d) => d.state === "draft").map((d) => ({
    key: `d:${d.id}`, at: d.savedAt, when: formatDateTimeHr(d.savedAt), what: d.body, who: t.givenDraftLabel, state: "draft" as const, deleted: false,
  }));
  return [...published, ...unpublished].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.key.localeCompare(b.key)));
}
