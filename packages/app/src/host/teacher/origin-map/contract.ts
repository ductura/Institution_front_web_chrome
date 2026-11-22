// "Podrijetlo teksta" (WEB-0911; P-1; N-10). Server operation (SRV-0910 c):
//   work.origin-composition.get  { documentId } -> 200 composition of the text by origin kind
// The operation is not yet in the contract extract (src/client/migration-contract*.generated.*), so the
// name follows the `work.*` operations and the shape is the smallest the plan implies; both are listed as
// assumptions in the pull request. The answer is held to a closed schema: a key of any kind outside it
// (a pressed key, a speed, an average) makes the whole answer unusable, never a part of it.
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";

/** The closed list of origin kinds (P-1 rule 1 and 8), in the order the screen shows them. */
export const ORIGIN_KINDS = [
  "typed", "assistant_inserted", "assistant_match", "imported_file", "pasted_known", "pasted_unknown",
] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

export type OriginCall = (
  id: "work.origin-composition.get",
  input: { readonly params?: Readonly<Record<string, string>>; readonly query?: unknown; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type OriginShare = { readonly kind: OriginKind; readonly codePoints: number; readonly percent: number };
export type OriginSegment = {
  readonly id: string;
  readonly text: string;
  readonly kind: OriginKind;
  /** Minute of entry, ISO time. */
  readonly at: string;
  /** Gaps in ms between inputs inside a burst (P-1 rule 4). Absent when the rhythm is off or not recorded. */
  readonly gapsMs?: readonly number[];
};
export type OriginComposition = {
  readonly totalCodePoints: number;
  readonly shares: readonly OriginShare[];
  readonly segments: readonly OriginSegment[];
  /** False: the teacher switched the rhythm off; no rhythm is shown, also not in the replay. */
  readonly rhythmRecorded: boolean;
};

export type OriginRead =
  | { readonly kind: "ready"; readonly composition: OriginComposition }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export const MAX_GAPS_PER_BURST = 130;

const UNAVAILABLE = { kind: "unavailable" } as const;
const KIND: Schema = { anyOf: ORIGIN_KINDS.map((value): Schema => ({ const: value })) };
const SCHEMA: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["totalCodePoints", "shares", "segments", "rhythmRecorded"],
  properties: {
    totalCodePoints: { type: "integer", minimum: 0 },
    rhythmRecorded: { type: "boolean" },
    shares: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "codePoints", "percent"],
        properties: { kind: KIND, codePoints: { type: "integer", minimum: 0 }, percent: { type: "integer", minimum: 0, maximum: 100 } },
      },
    },
    segments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "kind", "at"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          kind: KIND,
          at: { type: "string", format: "date-time" },
          gapsMs: { type: "array", maxItems: MAX_GAPS_PER_BURST, items: { type: "integer", minimum: 0 } },
        },
      },
    },
  },
};

/** True when an answer that matches the schema also agrees with itself. */
export function compositionAgrees(c: OriginComposition): boolean {
  const kinds = c.shares.map((share) => share.kind);
  if (new Set(kinds).size !== kinds.length) return false;
  if (c.shares.reduce((sum, share) => sum + share.codePoints, 0) !== c.totalCodePoints) return false;
  const percents = c.shares.reduce((sum, share) => sum + share.percent, 0);
  if (c.totalCodePoints > 0 && (percents < 98 || percents > 102)) return false;
  if (c.totalCodePoints === 0 && c.shares.some((share) => share.percent !== 0)) return false;
  // A rhythm that the teacher switched off never arrives; one that does is a contract breach, not a display choice.
  return c.rhythmRecorded || c.segments.every((segment) => segment.gapsMs === undefined);
}

/** Reads the composition of one work. The student and the teacher send the same request and get the same answer. */
export async function readOriginComposition(call: OriginCall, documentId: string): Promise<OriginRead> {
  if (documentId.length === 0) return { kind: "notFound" };
  let result: Awaited<ReturnType<OriginCall>>;
  try {
    result = await call("work.origin-composition.get", { params: { documentId } });
  } catch {
    return UNAVAILABLE;
  }
  if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : result.status === 404 ? { kind: "notFound" } : UNAVAILABLE;
  if (result.status !== 200 || !matchesSchema(SCHEMA, result.body)) return UNAVAILABLE;
  const composition = result.body as OriginComposition;
  if (!compositionAgrees(composition)) return UNAVAILABLE;
  return composition.totalCodePoints === 0 ? { kind: "empty" } : { kind: "ready", composition };
}
