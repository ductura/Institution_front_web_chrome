// The "Prijavi problem" form as a model (DAN-873-3): what it shows and what one
// press of "Pošalji prijavu" does, over the steps of 873-2. Pure, so it is
// tested without a DOM; the React form and its catalogue entry wrap it in
// 873-3b (Ductus#1836 c.6957789173). Shown parts follow Ductus
// src/components/support/ProblemReport.tsx at 393b8e0; every text is from the catalogue.
import { messagesHr } from "../../../locales/hr.ts";
import { checkDescription, PROBLEM_REPORT_CATEGORIES, PROBLEM_REPORT_DESCRIPTION_MAX, type ProblemReportBody, type ProblemReportCategory, type ProblemReportInput, type SendOutcome } from "./problem-report";
import { canSend, checkMessage, submitProblemReport, textOf, type FormStep } from "./problem-report-form";

const t = messagesHr.support;

export type FormState = { category: ProblemReportCategory; description: string; shownCheck: boolean; step: FormStep };
export type FormContext = Pick<ProblemReportInput, "appVersion" | "pathname" | "syncState" | "userAgent">;
export type FormView = {
  heading: string;
  categories: { value: ProblemReportCategory; label: string; who: string; checked: boolean }[];
  counter: string | null;
  check: string | null;
  invalid: boolean;
  alert: string | null;
  status: string | null;
  sent: [string, string] | null;
  ended: string | null;
  button: { label: string; disabled: boolean } | null;
};

export const INITIAL_FORM: FormState = { category: "technical", description: "", shownCheck: false, step: { kind: "editing" } };

/**
 * One sender per form: `press` is one press of the button. send is called at
 * most once per press and never while an earlier press is still in flight;
 * onSending gets the sending state exactly when send is called. A send that
 * throws reads as a lost connection: the report may have arrived.
 */
export function createSender(send: (body: ProblemReportBody) => Promise<SendOutcome>) {
  let inFlight = false;
  return async function press(state: FormState, now: number, context: FormContext, onSending: (state: FormState) => void): Promise<FormState> {
    if (inFlight) return state;
    inFlight = true;
    try {
      const guarded = async (body: ProblemReportBody): Promise<SendOutcome> => {
        onSending({ ...state, step: { kind: "sending" } });
        try {
          return await send(body);
        } catch {
          return { kind: "failed", messageKey: "support.failure.network", retryAt: null };
        }
      };
      const result = await submitProblemReport({ ...context, category: state.category, description: state.description }, state.step, now, guarded);
      if (result === null || "refused" in result) return state;
      if ("check" in result) return { ...state, shownCheck: true };
      return { ...state, step: result.step };
    } finally {
      inFlight = false;
    }
  };
}

/** Milliseconds until a 429 lets sending again; null when nothing is locked. */
export function unlockDelay(step: FormStep, now: number): number | null {
  if (step.kind !== "failed" || step.retryAt === null || now >= step.retryAt) return null;
  return step.retryAt - now;
}

/** One timer that redraws the form when the lock ends, or none; returns its cancel. */
export function scheduleUnlock<T>(
  step: FormStep, now: number, setTimer: (run: () => void, ms: number) => T, clearTimer: (timer: T) => void, onUnlock: () => void,
): () => void {
  const delay = unlockDelay(step, now);
  if (delay === null) return () => {};
  const timer = setTimer(onUnlock, delay);
  return () => clearTimer(timer);
}

/** What the form shows for a state at time now. */
export function formView(state: FormState, now: number): FormView {
  const { step } = state;
  const none = { categories: [], counter: null, check: null, invalid: false, alert: null, status: null, sent: null, ended: null, button: null };
  if (step.kind === "sent") {
    return { ...none, heading: t.sentTitle, sent: [t.sentReference.replace("{reference}", step.reference), t.sentNote] };
  }
  if (step.kind === "ended") return { ...none, heading: t.title, ended: t.ended };
  const length = [...state.description].length;
  const check = state.shownCheck ? checkMessage(checkDescription(state.description), length) : null;
  return {
    ...none,
    heading: t.title,
    categories: PROBLEM_REPORT_CATEGORIES.map((value) => ({ value, ...t.category[value], checked: value === state.category })),
    counter: t.counter.replace("{n}", String(length)).replace("{max}", String(PROBLEM_REPORT_DESCRIPTION_MAX)),
    check,
    invalid: check !== null,
    alert: step.kind === "failed" ? `${textOf(step.lead) ?? t.failedLead} ${textOf(step.messageKey) ?? t.failure.unknown}` : null,
    status: step.kind === "sending" ? t.sending : null,
    button: { label: step.kind === "failed" ? t.retry : t.send, disabled: !canSend(step, now) },
  };
}
