// WEB-2109: pure parts of step 4 (E-10, PD-3): the stage with an extended deadline, the answer of the
// submission as a line, and the counts the dialog and page state.
import type { SubmissionRead, SubmitOutcome } from "../../../../../../../src/client/submission";
import type { TextNode } from "../work-read";
import { atOf as atText, clockOf, dayOf } from "../steps/time";
import { submitText as t } from "./messages.hr";
import { forbiddenLines, type Timing } from "./timing";

export type SubmitStage =
  | { readonly kind: "open" }
  | { readonly kind: "extended"; readonly until: string }
  | { readonly kind: "closed"; readonly dueAt: string }
  | { readonly kind: "submitted" }
  | { readonly kind: "unavailable" };

/** C-15: the deadline that counts is the extended one when the teacher gave a later one. */
export function submitStageOf(workState: string, dueAt: string, extendedDueAt: string | null | undefined, now: number): SubmitStage {
  if (workState === "submitted") return { kind: "submitted" };
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return { kind: "unavailable" };
  const ext = extendedDueAt == null ? Number.NaN : Date.parse(extendedDueAt);
  if (Number.isFinite(ext) && ext > due) return ext < now ? { kind: "closed", dueAt: extendedDueAt as string } : { kind: "extended", until: extendedDueAt as string };
  return due < now ? { kind: "closed", dueAt } : { kind: "open" };
}

export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function dateOf(iso: string): { date: string; time: string } {
  const date = dayOf(iso);
  const time = clockOf(iso);
  return date === null || time === null ? { date: iso, time: "" } : { date, time };
}

/** "5. 11. 2026. u 21:14", the prototype's fmt(); the raw text when it cannot be read. */
export const atOf = atText;

export function whenOf(iso: string): string {
  return atText(iso);
}

/** "5.120": thousands separated by a point, as the prototype writes a count of words. */
export function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function wordCount(nodes: readonly TextNode[]): number {
  let n = 0;
  for (const node of nodes) for (const child of node.children) n += child.text.split(/\s+/u).filter((w) => w !== "").length;
  return n;
}

export type Line = {
  readonly go: null;
  readonly title?: string;
  readonly text: readonly string[];
  /** The line read out first (role="alert"); the last one when not given. */
  readonly alertAt?: number;
  /**
   * What the panel offers: "retryWhenSaved" a "Pokušaj ponovno" open only once the device holds nothing the
   * server has not confirmed (PR-8); "back" the way to the workspace and to step 3 (not open, PR-17).
   */
  readonly offer?: "check" | "reload" | "workspace" | "declaration" | "retryWhenSaved" | "back";
  /** False: the outcome is a panel of its own, without "Predaj rad" (PR-8, PR-9). */
  readonly retry: boolean;
  /** PR-9: the outcome is unknown, so the state is read again on reconnection and after 10 s. */
  readonly recheck?: boolean;
  /**
   * S-08 D9: the line reports a state (waiting for the signature, not recorded), not an error; it stays plain
   * text. Every other line of an outcome is an error and is written in the error colour (`isErrorLine`), except
   * the warning with the way to the declaration (declaration_required is no error).
   */
  readonly plain?: boolean;
};

/** S-08: whether the lines of an outcome say an error (blocked, incomplete, unknown, errors) rather than a state. */
export const isErrorLine = (line: Line): boolean => line.plain !== true && line.offer !== "declaration";
export type Next = { readonly go: "receipt" | "notice" | "signIn" } | Line;
export type Answer = SubmitOutcome | { readonly kind: "check"; readonly state: SubmissionRead };

/**
 * `requestedAt`: when the server says the request arrived, if it does; `alternative`: the procedure the server
 * names, if any (P-2156); `timing`: where the deadline stands, for the panel of a submission not open (409 not_open).
 */
export type Known = { readonly requestedAt: string | null; readonly alternative: boolean; readonly timing?: Timing };

const NOTHING_KNOWN: Known = { requestedAt: null, alternative: false };

/** PR-9: one true message. A known request time says the submission was asked for; without it, it may be submitted. */
const unknown = (requestedAt: string | null): Line => ({
  go: null, title: t.panelTitle, offer: "check", retry: false, recheck: true, alertAt: 1,
  text: [requestedAt === null ? t.unknown : fill(t.unknownRequested, { when: whenOf(requestedAt) }), t.unknownAlert],
});

function fromState(state: SubmissionRead): Next {
  switch (state.kind) {
    case "potvrdeno": return { go: "receipt" };
    case "ceka": return { go: null, title: t.panelTitle, text: [fill(t.unknownRequested, { when: whenOf(state.requestedAt) }), t.waiting], offer: "check", retry: false, plain: true };
    case "none": return { go: null, text: [t.notRecorded], retry: true, plain: true };
    case "session-expired": return { go: "signIn" };
    case "greska": return state.code === "not_found" ? { go: null, text: [t.errors.not_found], retry: false } : unknown(null);
    default: return unknown(null);
  }
}

/** PR-8: `record_mismatch`, with the request time and the procedure only when the server names them. */
function incomplete(known: Known): Line {
  const text: string[] = [t.incompleteMismatch];
  if (known.requestedAt !== null) text.push(fill(t.incompleteRequested, { when: whenOf(known.requestedAt) }));
  text.push(known.alternative ? t.incompleteAlternative : t.incompleteUnavailable);
  return { go: null, title: t.incompleteTitle, text, alertAt: 0, retry: false };
}

export function nextOf(answer: Answer, known: Known = NOTHING_KNOWN): Next {
  switch (answer.kind) {
    case "predano": return { go: "receipt" };
    case "session-expired": return { go: "signIn" };
    // PR-8: not submitted; the same request is not offered again until the device has nothing unconfirmed.
    case "odbijeno": return { go: null, title: t.refusedTitle, text: [t.blocked[answer.reason], t.notSavedLine], alertAt: 0, offer: "retryWhenSaved", retry: false };
    // PIL-K-IZJAVA-VRATA: 409 declaration_required is a warning with the way to step 2, not a technical error.
    case "izjava": return { go: null, title: t.declarationRequiredTitle, text: [t.declarationRequired], offer: "declaration", retry: true };
    case "nedovrseno": return incomplete(known);
    case "stanje":
    case "check": return fromState(answer.state);
    case "greska":
      if (answer.code === "not_acknowledged") return { go: "notice" };
      if (answer.code === "stale_revision") return { go: null, title: t.refusedTitle, text: [t.errors.stale_revision, t.notSubmitted], alertAt: 0, offer: "reload", retry: false };
      // PR-17, Daniel's answer 3: the assignment does not take a submission after the deadline.
      if (answer.code === "not_open") return { go: null, title: t.late.forbiddenTitle, text: forbiddenLines(known.timing ?? { kind: "unavailable" }), alertAt: 0, offer: "back", retry: false };
      return { go: null, text: [Object.hasOwn(t.errors, answer.code) ? t.errors[answer.code as keyof typeof t.errors] : t.errors.other], retry: true };
    default: return unknown(known.requestedAt);
  }
}

/** The extended deadline of one assignment in a student.assignments.get body (C-15), or null. */
export function extendedDueOf(body: unknown, assignmentId: string): string | null {
  const courses = (body as { courses?: readonly { assignments?: readonly { id: string; extendedDueAt?: string | null }[] }[] } | null)?.courses;
  for (const course of courses ?? []) {
    const found = course.assignments?.find((a) => a.id.toLowerCase() === assignmentId);
    if (found !== undefined) return found.extendedDueAt ?? null;
  }
  return null;
}
