// The steps of the "Prijavi problem" form (DAN-873-2): when it sends, what it
// shows after an answer and when sending is locked. Ported from Ductus
// src/components/support/ProblemReport.tsx at 393b8e0 (stepAfter, checkMessage)
// over the web model; new is the lock until retryAt of a 429. No React, no
// network and no clock: send and now come in, so the vectors drive every step.
import { messagesHr } from "../../../locales/hr.ts";
import {
  buildProblemReportBody,
  checkDescription,
  PROBLEM_REPORT_DESCRIPTION_MAX,
  type DescriptionCheck,
  type ProblemReportBody,
  type ProblemReportInput,
  type SendOutcome,
} from "./problem-report";

export type FormStep =
  | { kind: "editing" }
  | { kind: "sending" }
  | { kind: "sent"; reference: string }
  | { kind: "failed"; lead: string; messageKey: string; retryAt: number | null }
  | { kind: "ended"; delivery: "notSent" };

/** A send that did not go because the session had ended (Ductus `ended`; the session watch comes with the form). */
export type FormOutcome = SendOutcome | { kind: "ended" };

export type SubmitResult = { check: Exclude<DescriptionCheck, "ok"> } | { refused: "category" } | { step: FormStep } | null;

/** Answers after which the report may still have been recorded: these must not say it was not sent. */
const MAYBE_RECORDED = new Set(["support.failure.network", "support.failure.timeout", "support.failure.unavailable", "support.failure.unknown"]);

export function stepAfter(outcome: FormOutcome): FormStep {
  if (outcome.kind === "sent") return { kind: "sent", reference: outcome.reference };
  if (outcome.kind === "ended") return { kind: "ended", delivery: "notSent" };
  const lead = MAYBE_RECORDED.has(outcome.messageKey) ? "support.keptLead" : "support.failedLead";
  return { kind: "failed", lead, messageKey: outcome.messageKey, retryAt: outcome.retryAt };
}

/** False while a send is in flight and, after a 429, until its retryAt. */
export function canSend(step: FormStep, now: number): boolean {
  if (step.kind === "sending") return false;
  return step.kind !== "failed" || step.retryAt === null || now >= step.retryAt;
}

/**
 * One press of the send button: send is called exactly once, or not at all
 * when the description or category is outside its class (the result says
 * which) or sending is locked (null).
 */
export async function submitProblemReport(
  input: ProblemReportInput,
  step: FormStep,
  now: number,
  send: (body: ProblemReportBody) => Promise<SendOutcome>,
): Promise<SubmitResult> {
  if (!canSend(step, now)) return null;
  const check = checkDescription(input.description);
  if (check !== "ok") return { check };
  const body = buildProblemReportBody(input);
  if (body === null) return { refused: "category" };
  return { step: stepAfter(await send(body)) };
}

/** The Croatian text of a catalogue key; null unless it is an own string. */
export function textOf(key: string): string | null {
  let node: unknown = messagesHr;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object" || !Object.hasOwn(node, part)) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}

/** What the field says about a description that cannot go yet; null when it can. */
export function checkMessage(check: DescriptionCheck, length: number): string | null {
  const t = messagesHr.support.check;
  if (check === "ok") return null;
  if (check === "tooLong") return t.tooLong.replace("{n}", String(length)).replace("{max}", String(PROBLEM_REPORT_DESCRIPTION_MAX));
  return t[check];
}
