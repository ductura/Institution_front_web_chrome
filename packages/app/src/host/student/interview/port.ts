// Student side of the interview preparation (PIL-K-RAZGOVOR, N-14). The page talks only to this port;
// the real one answers through src/client/work-interview.ts (work.interview.get and
// work.interview-explanations.post), the fake one (fake-port.ts) through memory for the tests.
// There is deliberately no field for an outcome, grade, sanction or suspicion.
import {
  readInterviewAsStudent, sendInterviewExplanation, type InterviewExplanation as Stored, type InterviewPreparation,
} from "../../../../../../src/client/work-interview";
import type { ApiOptions } from "../../../../../../src/client/api";

export const NOTE_MAX_BYTES = 2 * 1024 * 1024;
export const NOTE_FORMATS = [".pdf", ".txt", ".md"] as const;
/** The contract's limit of one explanation (work.interview-explanations.post, text maxLength). */
export const EXPLANATION_MAX_CHARS = 2000;

export type InterviewQuestion = { readonly id: string; readonly paragraphRef: string | null; readonly paragraphExcerpt?: string; readonly text: string };
export type InterviewSlot = { readonly kind: "consultation" | "free"; readonly place: string; readonly at: string };
export type InterviewExplanation = { readonly id: string; readonly questionId: string | null; readonly text: string };

export type InterviewRead =
  | { readonly kind: "ready"; readonly workTitle: string | null; readonly questions: readonly InterviewQuestion[];
      readonly slot: InterviewSlot | null; readonly heldAt: string | null; readonly explanations: readonly InterviewExplanation[];
      readonly attachments: readonly string[] }
  | { readonly kind: "notInvited" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export type InterviewWrite =
  | { readonly kind: "saved"; readonly explanation?: InterviewExplanation }
  | { readonly kind: "rejected" } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" };

export interface InterviewPort {
  read(documentId: string): Promise<InterviewRead>;
  explain(documentId: string, input: { readonly questionId: string | null; readonly text: string }): Promise<InterviewWrite>;
  /** Absent while the server has no route for notes (PIL-K-RAZGOVOR-SRV); the page then hides the field. */
  attachNote?(documentId: string, file: File): Promise<InterviewWrite>;
}

const explanationOf = (e: Stored): InterviewExplanation => ({ id: e.id, questionId: e.questionId ?? null, text: e.text });

/**
 * The server's preparation as the student's page reads it. Questions are shown only once the student is
 * invited (invitedAt), and then exactly those the server returns; the contract names no work title.
 */
export function readOfPreparation(p: InterviewPreparation): InterviewRead {
  if (p.invitedAt === null) return { kind: "notInvited" };
  const slot: InterviewSlot | null = p.appointment === null ? null
    : "place" in p.appointment ? { kind: "free", place: p.appointment.place, at: p.appointment.at }
      : { kind: "consultation", place: "", at: p.appointment.startsAt };
  return {
    kind: "ready", workTitle: null, slot, heldAt: p.heldOn, attachments: [],
    questions: p.questions.map((q) => ({ id: q.id, paragraphRef: q.paragraphRef, text: q.questionText })),
    explanations: p.explanations.map(explanationOf),
  };
}

/** The real port; `options` only for the tests' transport. */
export const studentInterviewPortWith = (options?: ApiOptions): InterviewPort => ({
  async read(documentId) {
    const answer = await readInterviewAsStudent(documentId, options);
    switch (answer.kind) {
      case "ok": return readOfPreparation(answer.value);
      case "notInvited": case "signedOut": case "notFound": return { kind: answer.kind };
      default: return { kind: "unavailable" };
    }
  },
  async explain(documentId, input) {
    const answer = await sendInterviewExplanation(documentId, { questionId: input.questionId, text: input.text }, options);
    switch (answer.kind) {
      case "ok": return { kind: "saved", explanation: explanationOf(answer.value) };
      case "rejected": case "signedOut": return { kind: answer.kind };
      default: return { kind: "unavailable" };
    }
  },
});

export const studentInterviewPort: InterviewPort = studentInterviewPortWith();
