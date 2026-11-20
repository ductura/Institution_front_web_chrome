/**
 * Consultation slots for one work (WEB-1108; Wave 11, E 3.5 mentor2).
 * The student asks for a slot, the teacher confirms it or proposes another
 * time, the student accepts the proposal; both sides see the same confirmed
 * slot.
 *
 * GET  /api/v1/works/{documentId}/consultation-slots            -> 200 {slots}
 * POST /api/v1/works/{documentId}/consultation-slots {startsAt}  -> 201 slot
 * PATCH .../consultation-slots/{slotId} {action, startsAt?}      -> 200 slot
 *
 * A write counts as done only when the answer names the same slot and carries
 * the status the action leads to (B-6): anything else is "nepoznato" and the
 * form keeps what was typed. A 409 means the slot was changed meanwhile.
 *
 * TODO(ugovor): the three routes are not in @ductura/contracts yet. Until
 * then the shapes are local, the caller passes the transport (`SlotsCall`)
 * and only tests call them, with invented answers.
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export const SLOT_STATUSES = ["requested", "proposed", "confirmed"] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];
export type SlotAction = "confirm" | "propose" | "accept";

/** `startsAt` is the time asked for; with `proposed` it is the teacher's counter-proposal. */
export type ConsultationSlot = {
  readonly slotId: string;
  readonly startsAt: string;
  readonly status: SlotStatus;
};

export type SlotsCall = (
  id: "works.consultation-slots.get" | "works.consultation-slots.post" | "works.consultation-slots.patch",
  input: {
    readonly documentId: string;
    readonly slotId?: string;
    readonly body?: { readonly startsAt?: string; readonly action?: SlotAction };
  },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

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
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const SLOT: Schema = closed({
  slotId: UUID,
  startsAt: { type: "string", format: "date-time" },
  status: { anyOf: SLOT_STATUSES.map((s) => ({ const: s })) },
});
const LIST: Schema = closed({ slots: { type: "array", maxItems: 200, items: SLOT } });

/** The status an action leads to; the answer must show it. */
const RESULT: Record<SlotAction, SlotStatus> = { confirm: "confirmed", propose: "proposed", accept: "confirmed" };

/** True for a real ISO time (RFC 3339 with offset) the server can accept. */
export const validStartsAt = (value: string): boolean =>
  matchesSchema({ type: "string", format: "date-time" }, value) && !Number.isNaN(Date.parse(value));

/** GET. At most one answer per slot id; anything else is unknown, never a short list. Never throws. */
export async function readConsultationSlots(call: SlotsCall, documentId: string): Promise<SlotsRead> {
  try {
    const result = await call("works.consultation-slots.get", { documentId });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return UNKNOWN;
    const { slots } = result.body as { slots: ConsultationSlot[] };
    return new Set(slots.map((s) => s.slotId)).size === slots.length ? { kind: "ready", slots } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

function failure(result: { ok: false; status: number }): SlotWrite {
  if (result.status === 401) return { kind: "session-expired" };
  if (result.status === 409) return { kind: "promijenjeno" };
  if (result.status === 404) return { kind: "greska", code: "not_found" };
  if (result.status === 422) return { kind: "greska", code: "invalid" };
  return UNKNOWN;
}

/** POST: the student asks for a slot. Saved only from a 201 `requested` slot with the time asked. */
export async function requestConsultationSlot(call: SlotsCall, documentId: string, startsAt: string): Promise<SlotWrite> {
  if (!validStartsAt(startsAt)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("works.consultation-slots.post", { documentId, body: { startsAt } });
    if (!result.ok) return failure(result);
    if (result.status !== 201 || !matchesSchema(SLOT, result.body)) return UNKNOWN;
    const slot = result.body as ConsultationSlot;
    return slot.status === "requested" && Date.parse(slot.startsAt) === Date.parse(startsAt) ? { kind: "saved", slot } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** PATCH. Only `propose` carries a time; the others are sent without a body time. Never throws. */
export async function updateConsultationSlot(
  call: SlotsCall, documentId: string, slotId: string, action: SlotAction, startsAt?: string,
): Promise<SlotWrite> {
  const sendable = matchesSchema(UUID, slotId)
    && (action === "propose" ? startsAt !== undefined && validStartsAt(startsAt) : startsAt === undefined);
  if (!sendable) return { kind: "greska", code: "invalid" };
  const body = action === "propose" ? { action, startsAt } : { action };
  try {
    const result = await call("works.consultation-slots.patch", { documentId, slotId, body });
    if (!result.ok) return failure(result);
    if (result.status !== 200 || !matchesSchema(SLOT, result.body)) return UNKNOWN;
    const slot = result.body as ConsultationSlot;
    if (slot.slotId !== slotId || slot.status !== RESULT[action]) return UNKNOWN;
    if (action === "propose" && Date.parse(slot.startsAt) !== Date.parse(startsAt as string)) return UNKNOWN;
    return { kind: "saved", slot };
  } catch {
    return UNKNOWN;
  }
}
