/**
 * Consultation slots for one work (WEB-1108; WEB-2001 contract alignment).
 * The student asks for a slot, the teacher confirms it or counters with
 * another time, the student accepts the counter; both sides see the same
 * confirmed slot.
 *
 * Server operations (generated contract extract):
 *   work.consultation-slots.get  (GET)
 *   work.consultation-slots.post  (POST)
 *   work.consultation-slots.patch  (PATCH)
 *
 * A write counts as done only when the answer names the same slot and carries
 * the state the action leads to (B-6): anything else is "nepoznato" and the
 * form keeps what was typed. A 409 means the slot was changed meanwhile.
 */

import { createApi, type ApiResult } from "./api";
import { matchesSchema } from "./schema-check";
import type { Read } from "./submission";

type Body<T> = Extract<T, { ok: true }> extends { body: infer Shape } ? Shape : never;

/** `startsAt` is the time asked for; with `countered` it is the teacher's counter-proposal. */
export type ConsultationSlot = Body<ApiResult<"work.consultation-slots.post">>;
export type SlotState = ConsultationSlot["state"];
export type SlotAction = "confirm" | "counter" | "accept";
/** The client from `createApi`; the caller owns the transport. */
export type SlotsApi = ReturnType<typeof createApi>;

export type SlotsRead = Read<{ readonly kind: "ready"; readonly slots: readonly ConsultationSlot[] }>;
export type SlotWrite =
  | { readonly kind: "saved"; readonly slot: ConsultationSlot }
  | { readonly kind: "session-expired" }
  /** 409: the slot was changed or removed meanwhile; the list is read again. */
  | { readonly kind: "promijenjeno" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the write may be recorded. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;

/** The state an action leads to; the answer must show it. */
const RESULT: Record<SlotAction, SlotState> = { confirm: "confirmed", counter: "countered", accept: "confirmed" };

/** True for a real ISO time (RFC 3339 with offset) the server can accept. */
export const validStartsAt = (value: string): boolean =>
  matchesSchema({ type: "string", format: "date-time" }, value) && !Number.isNaN(Date.parse(value));

/** GET. At most one answer per slot id; anything else is unknown, never a short list. Never throws. */
export async function readConsultationSlots(api: SlotsApi, documentId: string): Promise<SlotsRead> {
  try {
    const result = await api("work.consultation-slots.get", { params: { documentId }, query: undefined, body: undefined });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    const { slots } = result.body;
    return new Set(slots.map((s) => s.id)).size === slots.length ? { kind: "ready", slots } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

function failure(result: { ok: false; status: number; code: string }): SlotWrite {
  if (result.status === 401) return { kind: "session-expired" };
  if (result.status === 409) return { kind: "promijenjeno" };
  if (result.status === 404) return { kind: "greska", code: "not_found" };
  if (result.status === 422 || result.code === "invalid_input" || result.code === "client_rejected") return { kind: "greska", code: "invalid" };
  return UNKNOWN;
}

/** POST: the student asks for a slot. Saved only from a `requested` slot with the time asked. */
export async function requestConsultationSlot(api: SlotsApi, documentId: string, startsAt: string): Promise<SlotWrite> {
  if (!validStartsAt(startsAt)) return { kind: "greska", code: "invalid" };
  try {
    const result = await api("work.consultation-slots.post", { params: { documentId }, query: undefined, body: { startsAt } });
    if (!result.ok) return failure(result);
    const slot = result.body;
    return slot.state === "requested" && Date.parse(slot.startsAt) === Date.parse(startsAt) ? { kind: "saved", slot } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** PATCH. Only `counter` carries a time; the others are sent without a body time. Never throws. */
export async function updateConsultationSlot(
  api: SlotsApi, documentId: string, slotId: string, action: SlotAction, startsAt?: string,
): Promise<SlotWrite> {
  const sendable = matchesSchema(UUID, slotId)
    && (action === "counter" ? startsAt !== undefined && validStartsAt(startsAt) : startsAt === undefined);
  if (!sendable) return { kind: "greska", code: "invalid" };
  const body = action === "counter" ? { action, startsAt: startsAt as string } : { action };
  try {
    const result = await api("work.consultation-slots.patch", { params: { documentId, slotId }, query: undefined, body });
    if (!result.ok) return failure(result);
    const slot = result.body;
    if (slot.id !== slotId || slot.state !== RESULT[action]) return UNKNOWN;
    if (action === "counter" && Date.parse(slot.startsAt) !== Date.parse(startsAt as string)) return UNKNOWN;
    return { kind: "saved", slot };
  } catch {
    return UNKNOWN;
  }
}
