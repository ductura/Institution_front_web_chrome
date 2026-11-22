// Supplements and disputes of process-summary events (WEB-1305, plan M7.8, R-08) behind a port.
// The event-disputes routes of a work (read and write, under works/{documentId}) are not in the published
// contract package yet, so there is no wire shape here and no network call: the screens reach the
// data only through this port, and only the fake below implements it until the route is in the
// contract. A mark never changes the description of the event it stands under.

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
 * The only EventDisputesPort until the route is in the contract. All records are invented.
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
