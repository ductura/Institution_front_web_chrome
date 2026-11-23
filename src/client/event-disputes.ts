// Supplements and disputes of process-summary events (WEB-1305, plan M7.8, R-08) behind a port.
// createEventDisputes is the real port over createApi: work.event-disputes.get reads every mark of a
// work in one call, work.event-disputes.post records one. The wire says `amendment`, `disputeId` and
// `createdAt`; the screens keep their own words. The fake below stays for tests. A mark never changes
// the description of the event it stands under.

import type { createApi } from "./api";

type Api = ReturnType<typeof createApi>;

/** Longest text of one supplement or dispute, in code points. */
export const MAX_DISPUTE_LENGTH = 1000;

export type DisputeKind = "supplement" | "dispute";

export type EventDispute = {
  readonly id: string;
  readonly eventId: string;
  readonly kind: DisputeKind;
  readonly text: string;
  /** Start of the 5-minute window (P-03) the mark was written in. */
  readonly createdWindow: string;
};

export type DisputeListOutcome =
  | { readonly kind: "ok"; readonly disputes: readonly EventDispute[] }
  | { readonly kind: "signedOut" | "forbidden" | "unavailable" };

export type DisputeSubmitOutcome =
  | { readonly kind: "ok"; readonly dispute: EventDispute }
  | { readonly kind: "signedOut" | "forbidden" | "invalid" | "unavailable" };

export type DisputeInput = { readonly eventId: string; readonly kind: DisputeKind; readonly text: string };

/** 403 is `forbidden`, 422 is `invalid`; the client never names an author or a role. */
export interface EventDisputesPort {
  list(documentId: string): Promise<DisputeListOutcome>;
  send(documentId: string, input: DisputeInput): Promise<DisputeSubmitOutcome>;
}

/** Code points, not UTF-16 units: the limit counts what the student sees as characters. */
export function disputeLength(text: string): number {
  let n = 0;
  for (const _ of text) n += 1;
  return n;
}

/** A text the route can take: not blank, at most MAX_DISPUTE_LENGTH code points. */
export function isValidDisputeText(text: string): boolean {
  const n = disputeLength(text);
  return text.trim().length > 0 && n <= MAX_DISPUTE_LENGTH;
}

export type FakeEventDisputesOptions = {
  /** Every call answers with this failure instead of its normal result. */
  readonly fail?: "signedOut" | "forbidden" | "unavailable";
};

/**
 * The port for tests and the catalogue. All records are invented.
 * It answers 422 (`invalid`) for a text the route would refuse, so a screen that skips its own
 * check still sees the refusal.
 */
export function createFakeEventDisputes(
  initial: Readonly<Record<string, readonly EventDispute[]>> = {},
  options: FakeEventDisputesOptions = {},
): EventDisputesPort & { readonly sent: readonly (DisputeInput & { readonly documentId: string })[] } {
  const store = new Map<string, EventDispute[]>(Object.entries(initial).map(([id, rows]) => [id, [...rows]]));
  const sent: (DisputeInput & { documentId: string })[] = [];
  let counter = 0;
  return {
    sent,
    async list(documentId) {
      if (options.fail) return { kind: options.fail };
      return { kind: "ok", disputes: structuredClone(store.get(documentId) ?? []) };
    },
    async send(documentId, input) {
      sent.push({ documentId, ...input });
      if (options.fail) return { kind: options.fail };
      if (!isValidDisputeText(input.text)) return { kind: "invalid" };
      counter += 1;
      const dispute: EventDispute = {
        id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
        eventId: input.eventId,
        kind: input.kind,
        text: input.text,
        createdWindow: "2026-11-20T10:05:00.000Z",
      };
      store.set(documentId, [...(store.get(documentId) ?? []), dispute]);
      return { kind: "ok", dispute: structuredClone(dispute) };
    },
  };
}

type WireKind = "amendment" | "dispute";
type WireDispute = { readonly disputeId: string; readonly kind: WireKind; readonly eventId: string; readonly text: string; readonly createdAt: string };

const toWire = (kind: DisputeKind): WireKind => (kind === "supplement" ? "amendment" : "dispute");
const fromWire = (row: WireDispute): EventDispute => ({
  id: row.disputeId,
  eventId: row.eventId,
  kind: row.kind === "amendment" ? "supplement" : "dispute",
  text: row.text,
  createdWindow: row.createdAt,
});

function readFailure(status: number): Exclude<DisputeListOutcome, { kind: "ok" }> {
  if (status === 401) return { kind: "signedOut" };
  if (status === 403 || status === 404) return { kind: "forbidden" };
  return { kind: "unavailable" };
}

function sendFailure(status: number, code: string): Exclude<DisputeSubmitOutcome, { kind: "ok" }> {
  if (status === 401) return { kind: "signedOut" };
  if (status === 403 || status === 404) return { kind: "forbidden" };
  if (code === "client_rejected" || status === 400 || status === 413 || status === 415 || status === 422) return { kind: "invalid" };
  return { kind: "unavailable" };
}

/**
 * The port over the shared client (`call` is createApi()). A mark is `ok` only after the server's
 * 201 names it: the screen shows nothing the server has not recorded. A text over
 * MAX_DISPUTE_LENGTH or blank is `invalid` without a request.
 */
export function createEventDisputes(call: Api): EventDisputesPort {
  return {
    async list(documentId) {
      try {
        const result = await call("work.event-disputes.get", { params: { documentId }, query: undefined, body: undefined });
        if (!result.ok) return readFailure(result.status);
        return { kind: "ok", disputes: (result.body.disputes as readonly WireDispute[]).map(fromWire) };
      } catch {
        return { kind: "unavailable" };
      }
    },
    async send(documentId, input) {
      if (!isValidDisputeText(input.text)) return { kind: "invalid" };
      try {
        const result = await call("work.event-disputes.post", {
          params: { documentId }, query: undefined, body: { kind: toWire(input.kind), eventId: input.eventId, text: input.text },
        });
        if (!result.ok) return sendFailure(result.status, result.code);
        const body = result.body as { readonly disputeId: string; readonly createdAt: string };
        return { kind: "ok", dispute: { id: body.disputeId, eventId: input.eventId, kind: input.kind, text: input.text, createdWindow: body.createdAt } };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}
