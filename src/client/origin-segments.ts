// The ranges of origin of one revision (PM1-R01, F4-PM1-R01; origin-segments-v1) behind a port.
// `work.origin-segments.post` records, once per revision and only by the student who owns the work,
// where each range of each text block came from (typed, pasted_*, imported_file, assistant_*);
// `work.origin-segments.get` reads them back for the same work. The route is the server's as merged
// (SRV, ZD409, append-only); this file only calls it. A range never carries text: a block id, two
// offsets in code points and a kind from the closed list.

import { createApi, type ApiResult } from "./api";
import { ORIGIN_KINDS, type OriginKind } from "./input-rhythm";

export type OriginSegment = {
  readonly blockId: string;
  /** Code points from the start of the block's text, as `textBlocksOf` counts them. */
  readonly start: number;
  readonly end: number;
  readonly kind: OriginKind;
};

/** The contract's `maxItems` for one revision. */
export const MAX_ORIGIN_SEGMENTS = 10_000;
/** The contract's pattern of a block id (a UUID, versions 1 to 8). */
export const BLOCK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_END = 10_000_000;

/**
 * What the server answered. `already` is 409: the revision has its ranges (append-only), so
 * nothing is sent for it again. `rejected` is 422 or an input the client refused before sending.
 */
export type OriginRecordAnswer =
  | { readonly kind: "recorded"; readonly revision: number; readonly recorded: number }
  | { readonly kind: "already" | "notFound" | "rejected" | "signedOut" | "unavailable" | "empty" };

/** The ranges the server keeps for the latest revision of the work, or nothing it could say. */
export type OriginStoredAnswer =
  | { readonly kind: "ready"; readonly revision: number | null; readonly segments: readonly OriginSegment[] }
  | { readonly kind: "unavailable" };

export interface OriginSegmentsPort {
  record(documentId: string, revision: number, segments: readonly OriginSegment[]): Promise<OriginRecordAnswer>;
  stored(documentId: string): Promise<OriginStoredAnswer>;
}

type Call = ReturnType<typeof createApi>;

const isKind = (value: unknown): value is OriginKind => (ORIGIN_KINDS as readonly unknown[]).includes(value);

/** A range the contract takes: a block id of the pattern, 0 <= start < end <= 10 000 000, a known kind. */
export function isValidSegment(segment: OriginSegment): boolean {
  return BLOCK_ID.test(segment.blockId) && Number.isInteger(segment.start) && Number.isInteger(segment.end) &&
    segment.start >= 0 && segment.end > segment.start && segment.end <= MAX_END && isKind(segment.kind);
}

/** The answer of work.origin-segments.post; only a 201 counts as recorded. */
export function recordedOf(result: ApiResult<"work.origin-segments.post">): OriginRecordAnswer {
  if (result.ok) return { kind: "recorded", revision: result.body.revision, recorded: result.body.recorded };
  if (result.status === 401) return { kind: "signedOut" };
  if (result.status === 404) return { kind: "notFound" };
  if (result.status === 409) return { kind: "already" };
  if (result.status === 422 || result.status === 0) return { kind: "rejected" };
  return { kind: "unavailable" };
}

/**
 * The port over the server. Nothing here throws, and nothing is sent without at least one valid
 * range (the contract's `minItems: 1`). The client is made on the first call, so a page without
 * `location` (a test) can hold a port it never uses.
 */
export function createOriginSegmentsPort(call?: Call): OriginSegmentsPort {
  let made: Call | null = call ?? null;
  const api = (): Call => (made ??= createApi());
  return {
    async record(documentId, revision, segments) {
      const body = segments.filter(isValidSegment).slice(0, MAX_ORIGIN_SEGMENTS)
        .map(({ blockId, start, end, kind }) => ({ blockId, start, end, kind }));
      if (body.length === 0 || !Number.isSafeInteger(revision) || revision < 0) return { kind: "empty" };
      try {
        return recordedOf(await api()("work.origin-segments.post", { params: { documentId }, query: undefined, body: { revision, segments: body } }));
      } catch {
        return { kind: "unavailable" };
      }
    },
    async stored(documentId) {
      try {
        const result = await api()("work.origin-segments.get", { params: { documentId }, query: {}, body: undefined });
        if (!result.ok) return { kind: "unavailable" };
        const segments = result.body.segments.map(({ blockId, start, end, kind }) => ({ blockId, start, end, kind }));
        return { kind: "ready", revision: result.body.revision, segments };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}
