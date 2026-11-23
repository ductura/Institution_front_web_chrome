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

/** Why a read gave no list; the page names each with its own text and never shows a raw server code. */
export type ReadRefusal = "signedOut" | "denied" | "unavailable";
/**
 * Why a write is not confirmed. signedOut, denied and invalid are the server's own refusals (401, 403, 422);
 * notSent: the client refused the input before sending it; unconfirmed: the answer cannot tell whether the
 * server wrote the change (dropped connection, 5xx, an unreadable success), so the page asks for a reload.
 */
export type WriteRefusal = "signedOut" | "denied" | "invalid" | "notSent" | "unconfirmed";
export type Refusal = ReadRefusal | WriteRefusal;
export type ThresholdsRead = { readonly kind: "ready"; readonly thresholds: readonly OriginThreshold[] } | { readonly kind: ReadRefusal };
export type ThresholdWrite = { readonly kind: "saved" } | { readonly kind: WriteRefusal };

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

const readRefusal = (status: number): ReadRefusal => (status === 401 ? "signedOut" : status === 403 ? "denied" : "unavailable");
const writeRefusal = (status: number, code: string): WriteRefusal =>
  status === 401 ? "signedOut" : status === 403 ? "denied" : status === 422 ? "invalid"
    : status === 0 && code === "client_rejected" ? "notSent" : "unconfirmed";

/**
 * The thresholds the faculty wrote, in the order of ORIGIN_KINDS; an answer outside the contract is unusable as a
 * whole. The percent is held to a whole number although the extract types the read as `number`: the put accepts
 * only integers, so a fraction can only come from a fault, and the page refuses it rather than show it rounded.
 */
export async function readThresholds(call: ThresholdCall): Promise<ThresholdsRead> {
  try {
    const result = await call("institution.origin-thresholds.get", { params: undefined, query: undefined, body: undefined });
    if (!result.ok) return { kind: readRefusal(result.status) };
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
  if (thresholdPercent === null || !(STRICTNESS as readonly string[]).includes(strictness) || !ORIGIN_KINDS.includes(origin)) return { kind: "notSent" };
  try {
    const result = await call("institution.origin-threshold.put", { params: { origin }, query: undefined, body: { thresholdPercent, strictness } });
    if (!result.ok) return { kind: writeRefusal(result.status, result.code) };
    return result.status === 200 ? { kind: "saved" } : { kind: "unconfirmed" };
  } catch {
    return { kind: "unconfirmed" };
  }
}

/** Removes the threshold of one kind: the kind is "bez praga" again. */
export async function deleteThreshold(call: ThresholdCall, origin: OriginKind): Promise<ThresholdWrite> {
  if (!ORIGIN_KINDS.includes(origin)) return { kind: "notSent" };
  try {
    const result = await call("institution.origin-threshold.delete", { params: { origin }, query: undefined, body: undefined });
    if (!result.ok) return { kind: writeRefusal(result.status, result.code) };
    return result.status === 204 ? { kind: "saved" } : { kind: "unconfirmed" };
  } catch {
    return { kind: "unconfirmed" };
  }
}
