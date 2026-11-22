// WEB-2109: pure parts of step 4 (E-10, PD-3): the stage with an extended deadline, the answer of the
// submission as a line, and the counts the dialog and page state.
import type { SubmissionRead, SubmitOutcome } from "../../../../../../../src/client/submission";
import type { TextNode } from "../../../../../../../src/components/student/SubmissionView";
import { zagrebParts } from "../../../../../../../src/components/summary/zagreb-time";
import { submitText as t } from "./messages.hr";

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
  const parts = zagrebParts(iso);
  return parts === null ? { date: iso, time: "" } : { date: parts.date, time: parts.time };
}

export function whenOf(iso: string): string {
  const { date, time } = dateOf(iso);
  return time === "" ? date : `${date} u ${time}`;
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
  readonly offer?: "check" | "reload" | "workspace";
  readonly retry: boolean;
};
export type Next = { readonly go: "receipt" | "notice" | "signIn" } | Line;
export type Answer = SubmitOutcome | { readonly kind: "check"; readonly state: SubmissionRead };

/** `requestedAt`: when the server says the request arrived, if it does; `alternative`: the procedure the server names, if any (P-2156). */
export type Known = { readonly requestedAt: string | null; readonly alternative: boolean };

const unknown = (requestedAt: string | null): Line => ({
  go: null, offer: "check", retry: false,
  text: requestedAt === null ? [t.unknown, t.unknownLines] : [fill(t.unknownRequested, { when: whenOf(requestedAt) }), t.unknownLines],
});

function fromState(state: SubmissionRead): Next {
  switch (state.kind) {
    case "potvrdeno": return { go: "receipt" };
    case "ceka": return { go: null, text: [fill(t.unknownRequested, { when: whenOf(state.requestedAt) }), t.waiting], offer: "check", retry: false };
    case "none": return { go: null, text: [t.notRecorded], retry: true };
    case "session-expired": return { go: "signIn" };
    case "greska": return state.code === "not_found" ? { go: null, text: [t.errors.not_found], retry: false } : unknown(null);
    default: return unknown(null);
  }
}

export function nextOf(answer: Answer, known: Known = { requestedAt: null, alternative: false }): Next {
  switch (answer.kind) {
    case "predano": return { go: "receipt" };
    case "session-expired": return { go: "signIn" };
    case "odbijeno": return { go: null, text: [t.blocked[answer.reason]], offer: "workspace", retry: true };
    case "nedovrseno":
      return { go: null, title: t.incompleteTitle, retry: false,
        text: known.alternative ? [known.requestedAt === null ? t.incompleteText : t.incompleteText.replace("Vrijeme Vašeg zahtjeva", `Vrijeme Vašeg zahtjeva (${whenOf(known.requestedAt)})`)] : [t.incompleteUnavailable] };
    case "stanje":
    case "check": return fromState(answer.state);
    case "greska":
      if (answer.code === "not_acknowledged") return { go: "notice" };
      if (answer.code === "stale_revision") return { go: null, text: [t.errors.stale_revision], offer: "reload", retry: false };
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
