// "Pragovi po vrsti podrijetla" (PIL-P1-PRAGOVI-ADMIN; P-1 rule 12; SRV-1111). Server operations, from the
// contract extract (src/client/migration-contracts.generated.json):
//   institution.origin-thresholds.get                -> 200 { thresholds: [{ origin, thresholdPercent, strictness }] }
//   institution.origin-threshold.put     { origin }  { thresholdPercent, strictness } -> 200 { changed }
//   institution.origin-threshold.delete  { origin }  -> 204 (the kind has no threshold)
// There are no default thresholds: a kind the server does not list has none. Only the institution
// administrator may read or change them; the server answers 403 to anyone else.
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";
import { ORIGIN_KINDS, type OriginKind } from "../../teacher/origin-map/contract";

export { ORIGIN_KINDS, type OriginKind };

export const STRICTNESS = ["hard", "soft"] as const;
export type Strictness = (typeof STRICTNESS)[number];

export type OriginThreshold = { readonly origin: OriginKind; readonly thresholdPercent: number; readonly strictness: Strictness };

export type ThresholdOperation = "institution.origin-thresholds.get" | "institution.origin-threshold.put" | "institution.origin-threshold.delete";
export type ThresholdCall = (
  id: ThresholdOperation,
  input: { readonly params: Readonly<Record<string, string>> | undefined; readonly query: undefined; readonly body: unknown },
) => Promise<{ ok: true; status: number; body?: unknown } | { ok: false; status: number; code: string }>;

/** A refusal the page names with its own text; it never shows a raw server code. */
export type Refusal = "signedOut" | "denied" | "invalid" | "unavailable";
export type ThresholdsRead = { readonly kind: "ready"; readonly thresholds: readonly OriginThreshold[] } | { readonly kind: Exclude<Refusal, "invalid"> };
export type ThresholdWrite = { readonly kind: "saved" } | { readonly kind: Refusal };

const KIND: Schema = { anyOf: ORIGIN_KINDS.map((value): Schema => ({ const: value })) };
const STRICT: Schema = { anyOf: STRICTNESS.map((value): Schema => ({ const: value })) };
const READ_SCHEMA: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["thresholds"],
  properties: {
    thresholds: {
      type: "array",
      maxItems: ORIGIN_KINDS.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["origin", "thresholdPercent", "strictness"],
        properties: { origin: KIND, thresholdPercent: { type: "integer", minimum: 0, maximum: 100 }, strictness: STRICT },
      },
    },
  },
};

/**
 * The percent as the administrator typed it, or null: a whole number from 0 to 100, digits only
 * (no sign, decimal point, exponent or "%"). A value that is not one is never sent.
 */
export function parsePercent(typed: string): number | null {
  const text = typed.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const value = Number(text);
  return value <= 100 ? value : null;
}

const refusal = (status: number): Refusal =>
  status === 401 ? "signedOut" : status === 403 ? "denied" : status === 422 || status === 0 ? "invalid" : "unavailable";

/** The thresholds the faculty wrote, in the order of ORIGIN_KINDS; an answer outside the contract is unusable as a whole. */
export async function readThresholds(call: ThresholdCall): Promise<ThresholdsRead> {
  try {
    const result = await call("institution.origin-thresholds.get", { params: undefined, query: undefined, body: undefined });
    if (!result.ok) {
      const kind = refusal(result.status);
      return { kind: kind === "invalid" ? "unavailable" : kind };
    }
    if (result.status !== 200 || !matchesSchema(READ_SCHEMA, result.body)) return { kind: "unavailable" };
    const rows = (result.body as { thresholds: OriginThreshold[] }).thresholds;
    if (new Set(rows.map((row) => row.origin)).size !== rows.length) return { kind: "unavailable" };
    const order = (row: OriginThreshold) => ORIGIN_KINDS.indexOf(row.origin);
    return { kind: "ready", thresholds: [...rows].sort((a, b) => order(a) - order(b)) };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Sets the threshold of one kind. An invalid percent or strictness is refused here, before anything is sent. */
export async function putThreshold(call: ThresholdCall, origin: OriginKind, typedPercent: string, strictness: string): Promise<ThresholdWrite> {
  const thresholdPercent = parsePercent(typedPercent);
  if (thresholdPercent === null || !(STRICTNESS as readonly string[]).includes(strictness) || !ORIGIN_KINDS.includes(origin)) return { kind: "invalid" };
  try {
    const result = await call("institution.origin-threshold.put", { params: { origin }, query: undefined, body: { thresholdPercent, strictness } });
    if (!result.ok) return { kind: refusal(result.status) };
    return result.status === 200 ? { kind: "saved" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Removes the threshold of one kind: the kind is "bez praga" again. */
export async function deleteThreshold(call: ThresholdCall, origin: OriginKind): Promise<ThresholdWrite> {
  if (!ORIGIN_KINDS.includes(origin)) return { kind: "invalid" };
  try {
    const result = await call("institution.origin-threshold.delete", { params: { origin }, query: undefined, body: undefined });
    if (!result.ok) return { kind: refusal(result.status) };
    return result.status === 204 ? { kind: "saved" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
