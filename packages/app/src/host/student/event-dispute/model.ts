import type { EventDisputeLabels, EventDisputeMark, EventDisputeResult } from "@ductura/ui";

import {
  MAX_DISPUTE_LENGTH,
  type DisputeKind,
  type DisputeListOutcome,
  type DisputeSubmitOutcome,
  type EventDispute,
  type EventDisputesPort,
} from "../../../../../../src/client/event-disputes";
import { eventDisputeText as text } from "./messages.hr";

export const eventDisputeLabels: EventDisputeLabels = {
  supplementAction: text.supplementAction,
  disputeAction: text.disputeAction,
  supplementTitle: text.supplementTitle,
  disputeTitle: text.disputeTitle,
  supplementMark: text.supplementMark,
  disputeMark: text.disputeMark,
  field: text.field,
  hint: text.hint,
  counter: text.counter,
  send: text.send,
  sending: text.sending,
  cancel: text.cancel,
  marksLabel: text.marksLabel,
  sent: text.sent,
  empty: text.empty,
  tooLong: text.tooLong,
  invalid: text.invalid,
  forbidden: text.forbidden,
  signedOut: text.signedOut,
  unavailable: text.unavailable,
};

export const DISPUTE_MAX = MAX_DISPUTE_LENGTH;

/** The marks under one event, in the order the server gave them. */
export function marksOf(disputes: readonly EventDispute[], eventId: string): EventDisputeMark[] {
  return disputes.filter((d) => d.eventId === eventId).map((d) => ({ id: d.id, kind: d.kind, text: d.text }));
}

export function resultOf(outcome: DisputeSubmitOutcome): EventDisputeResult {
  return outcome.kind;
}

export type DisputeLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly disputes: readonly EventDispute[] }
  | { readonly kind: "error" | "signedOut" };

export function loadOf(outcome: DisputeListOutcome): DisputeLoad {
  if (outcome.kind === "ok") return { kind: "ready", disputes: outcome.disputes };
  return { kind: outcome.kind === "signedOut" ? "signedOut" : "error" };
}

/** One send: the port decides; the screen keeps what it returns. */
export async function sendDispute(
  port: EventDisputesPort, documentId: string, eventId: string, kind: DisputeKind, body: string,
): Promise<DisputeSubmitOutcome> {
  return port.send(documentId, { eventId, kind, text: body });
}
