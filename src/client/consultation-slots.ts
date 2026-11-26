/**
 * Consultation slots for one work (WEB-1108; WEB-2001 contract alignment).
 * The student asks for a slot, the teacher confirms it or counters with
 * another time, the student accepts the counter; both sides see the same
 * confirmed slot.
 *
 * Server operations (generated contract extract):
 *   work.consultation-slots.get   GET   .../works/{documentId}/consultation-slots
 *   work.consultation-slots.post  POST  .../consultation-slots {startsAt}
 *   work.consultation-slot-requests.post POST .../consultation-slot-requests {startsAt, topic?, preparation?} (MEN-26)
 *   work.consultation-slots.patch PATCH .../consultation-slots/{slotId} {action, startsAt?}
 *   work.consultation-slot-details.get GET .../consultation-slot-details (closed slots too)
 *   work.consultation-slot-close.post  POST .../consultation-slots/{slotId}/close {action, reason?}
 *
 * A write counts as done only when the answer names the same slot and carries
 * the state the action leads to (B-6): anything else is "nepoznato" and the
 * form keeps what was typed. A 409 means the slot was changed meanwhile.
 */

import { createApi, type ApiResult } from "./api";
import contracts from "./migration-contracts.generated.json" with { type: "json" };
import { matchesSchema } from "./schema-check";
import type { Read } from "./submission";

type Body<T> = Extract<T, { ok: true }> extends { body: infer Shape } ? Shape : never;

/** `startsAt` is the time asked for; with `countered` it is the teacher's counter-proposal. */
export type ConsultationSlot = Body<ApiResult<"work.consultation-slots.post">>;
export type SlotState = ConsultationSlot["state"];
export type SlotAction = "confirm" | "counter" | "accept";
/** The client from `createApi`; the caller owns the transport. */
export type SlotsApi = ReturnType<typeof createApi>;
/** The page's own client, made at call time (the origin is read then, not while rendering). */
export const pageSlotsCall = ((...args: Parameters<SlotsApi>) => createApi()(...args)) as SlotsApi;

export type SlotsRead = Read<{ readonly kind: "ready"; readonly slots: readonly ConsultationSlot[] }>;
export type SlotWrite =
  | { readonly kind: "saved"; readonly slot: ConsultationSlot | SlotDetail }
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
export async function readConsultationSlots(client: SlotsApi, documentId: string): Promise<SlotsRead> {
  try {
    const result = await client("work.consultation-slots.get", { params: { documentId }, query: undefined, body: undefined });
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

function failure(result: { ok: false; status: number; code: string }): Exclude<SlotWrite, { kind: "saved" }> {
  if (result.status === 401) return { kind: "session-expired" };
  if (result.status === 409) return { kind: "promijenjeno" };
  if (result.status === 404) return { kind: "greska", code: "not_found" };
  if (result.status === 422 || result.code === "invalid_input" || result.code === "client_rejected") return { kind: "greska", code: "invalid" };
  return UNKNOWN;
}

/** The longest pattern bound `{1,n}` of a contract string schema; the limit comes from the contract, not from here. */
function patternMax(schema: unknown): number {
  const pattern = (schema as { pattern?: unknown } | undefined)?.pattern;
  const found = typeof pattern === "string" ? /\{1,(\d+)\}\(\?!/.exec(pattern) : null;
  if (!found) throw new Error("consultation contract: no length bound");
  return Number(found[1]);
}
type OpenSchema = { properties: Record<string, unknown> };
/** The topic of a slot: 1 to TOPIC_MAX code points (work.consultation-slots.post). */
export const TOPIC_MAX = patternMax((contracts["work.consultation-slots.post"].body as OpenSchema).properties.topic);
/** The reason given when a slot is closed: 1 to REASON_MAX code points (work.consultation-slot-close.post). */
export const REASON_MAX = patternMax((contracts["work.consultation-slot-close.post"].body as OpenSchema).properties.reason);

/** Code points, as the contract counts them. */
export const codePoints = (text: string): number => [...text].length;
/** Trimmed text within 1..max code points, undefined when blank, null when too long. */
export function optionalText(text: string, max: number): string | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  return codePoints(trimmed) > max ? null : trimmed;
}

/** The preparation attached to a request: the text the mentor reads and the two counts it was composed from. */
export type PreparationAttachment = { readonly text: string; readonly changedParagraphs: number; readonly resolvedComments: number };
/** The longest attached text, in code points (work.consultation-slot-requests.post). */
export const PREPARATION_MAX = patternMax(
  (((contracts["work.consultation-slot-requests.post"].body as OpenSchema).properties.preparation) as OpenSchema).properties.text,
);
const COUNT_MAX = 100000;

/** True when the attachment is what the contract takes: trimmed text of 1..PREPARATION_MAX code points, whole counts in range. */
export function validPreparation(p: PreparationAttachment): boolean {
  const count = (n: number) => Number.isInteger(n) && n >= 0 && n <= COUNT_MAX;
  return optionalText(p.text, PREPARATION_MAX) === p.text && count(p.changedParagraphs) && count(p.resolvedComments);
}

/**
 * POST: the student asks for a slot, with an optional topic and an optional preparation ("Priloži pripremu").
 * Without a preparation the request goes through work.consultation-slots.post as before; with one it goes through
 * work.consultation-slot-requests.post and is saved only when the answer carries the same preparation (B-6).
 */
export async function requestConsultationSlot(
  client: SlotsApi, documentId: string, startsAt: string, topic?: string, preparation?: PreparationAttachment,
): Promise<SlotWrite> {
  if (!validStartsAt(startsAt)) return { kind: "greska", code: "invalid" };
  if (topic !== undefined && optionalText(topic, TOPIC_MAX) !== topic) return { kind: "greska", code: "invalid" };
  if (preparation !== undefined && !validPreparation(preparation)) return { kind: "greska", code: "invalid" };
  try {
    const base = topic === undefined ? { startsAt } : { startsAt, topic };
    const result = preparation === undefined
      ? await client("work.consultation-slots.post", { params: { documentId }, query: undefined, body: base })
      : await client("work.consultation-slot-requests.post", {
        params: { documentId }, query: undefined,
        body: { ...base, preparation: { text: preparation.text, changedParagraphs: preparation.changedParagraphs, resolvedComments: preparation.resolvedComments } },
      });
    if (!result.ok) return failure(result);
    const slot = result.body;
    if (topic !== undefined && slot.topic !== topic) return UNKNOWN;
    if (preparation !== undefined) {
      const kept = "preparation" in slot ? slot.preparation : null;
      if (kept === null || kept === undefined || kept.text !== preparation.text
        || kept.changedParagraphs !== preparation.changedParagraphs || kept.resolvedComments !== preparation.resolvedComments) return UNKNOWN;
    }
    return slot.state === "requested" && Date.parse(slot.startsAt) === Date.parse(startsAt) ? { kind: "saved", slot } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** PATCH. Only `counter` carries a time; the others are sent without a body time. Never throws. */
export async function updateConsultationSlot(
  client: SlotsApi, documentId: string, slotId: string, action: SlotAction, startsAt?: string,
): Promise<SlotWrite> {
  const sendable = matchesSchema(UUID, slotId)
    && (action === "counter" ? startsAt !== undefined && validStartsAt(startsAt) : startsAt === undefined);
  if (!sendable) return { kind: "greska", code: "invalid" };
  const body = action === "counter" ? { action, startsAt: startsAt as string } : { action };
  try {
    const result = await client("work.consultation-slots.patch", { params: { documentId, slotId }, query: undefined, body });
    if (!result.ok) return failure(result);
    const slot = result.body;
    if (slot.id !== slotId || slot.state !== RESULT[action]) return UNKNOWN;
    if (action === "counter" && Date.parse(slot.startsAt) !== Date.parse(startsAt as string)) return UNKNOWN;
    return { kind: "saved", slot };
  } catch {
    return UNKNOWN;
  }
}

/** A slot with its topic, closing and preparation; closed slots too (work.consultation-slot-details.get). */
export type SlotDetail = Body<ApiResult<"work.consultation-slot-close.post">>;
export type DetailState = SlotDetail["state"];
export type CloseAction = "withdraw" | "decline" | "cancel";
export type DetailsRead = Read<{ readonly kind: "ready"; readonly slots: readonly SlotDetail[] }>;
export type CloseWrite = Exclude<SlotWrite, { kind: "saved" }> | { readonly kind: "saved"; readonly slot: SlotDetail };

const CLOSED: Record<CloseAction, DetailState> = { withdraw: "withdrawn", decline: "declined", cancel: "cancelled" };

/** GET of every slot, closed ones too. At most one answer per slot id; anything else is unknown. Never throws. */
export async function readSlotDetails(client: SlotsApi, documentId: string): Promise<DetailsRead> {
  try {
    const result = await client("work.consultation-slot-details.get", { params: { documentId }, query: undefined, body: undefined });
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

/**
 * POST close: withdraw (the student, while requested), decline (the teacher, while requested) or cancel
 * (either side, a countered or confirmed slot ahead). Saved only when the answer names the slot in the
 * closed state with the reason sent. 403 (the wrong side) and 409 (already closed or moved) read the list again.
 */
export async function closeConsultationSlot(
  client: SlotsApi, documentId: string, slotId: string, action: CloseAction, reason?: string,
): Promise<CloseWrite> {
  if (!matchesSchema(UUID, slotId) || !(action in CLOSED)) return { kind: "greska", code: "invalid" };
  if (reason !== undefined && optionalText(reason, REASON_MAX) !== reason) return { kind: "greska", code: "invalid" };
  try {
    const body = reason === undefined ? { action } : { action, reason };
    const result = await client("work.consultation-slot-close.post", { params: { documentId, slotId }, query: undefined, body });
    if (!result.ok) return result.status === 403 && result.code === "forbidden" ? { kind: "promijenjeno" } : failure(result);
    const slot = result.body;
    if (slot.id !== slotId || slot.state !== CLOSED[action] || slot.closing === null || slot.closing.reason !== (reason ?? null)) return UNKNOWN;
    return { kind: "saved", slot };
  } catch {
    return UNKNOWN;
  }
}
