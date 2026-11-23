// Student side of the interview preparation (PIL-K-RAZGOVOR, N-14). The page talks only to this port;
// the real one answers through src/client/work-interview.ts (work.interview.get,
// work.interview-explanations.post and work.interview-notes.post), the fake one (fake-port.ts) through memory for the tests.
// There is deliberately no field for an outcome, grade, sanction or suspicion.
import {
  INTERVIEW_NOTE_MAX_BYTES, interviewNoteBody, readInterviewAsStudent, sendInterviewExplanation, sendInterviewNote,
  type InterviewExplanation as Stored, type InterviewNoteMediaType, type InterviewPreparation,
} from "../../../../../../src/client/work-interview";
import type { ApiOptions } from "../../../../../../src/client/api";

/** SRV #644: a note is UTF-8 text or PDF of at most 1 MiB; the extension names its media type. */
export const NOTE_MAX_BYTES = INTERVIEW_NOTE_MAX_BYTES;
export const NOTE_FORMATS = [".pdf", ".txt"] as const;
export const NOTE_MEDIA_TYPES: Readonly<Record<(typeof NOTE_FORMATS)[number], InterviewNoteMediaType>> = { ".pdf": "application/pdf", ".txt": "text/plain" };
/** The route's limit of a file name (work.interview-notes.post, fileName maxLength). */
export const NOTE_NAME_MAX_CHARS = 200;
/** The contract's limit of one explanation (work.interview-explanations.post, text maxLength). */
export const EXPLANATION_MAX_CHARS = 2000;

export type InterviewQuestion = { readonly id: string; readonly paragraphRef: string | null; readonly paragraphExcerpt?: string; readonly text: string };
export type InterviewSlot = { readonly kind: "consultation" | "free"; readonly place: string; readonly at: string };
export type InterviewExplanation = { readonly id: string; readonly questionId: string | null; readonly text: string };
/** A note as the server confirmed it; work.interview.get does not list notes, so only this session's are shown. */
export type InterviewNote = { readonly id: string; readonly fileName: string };
/** A note checked by the page (model.ts) and ready to send. */
export type NoteUpload = { readonly fileName: string; readonly mediaType: InterviewNoteMediaType; readonly bytes: Uint8Array };

export type InterviewRead =
  | { readonly kind: "ready"; readonly workTitle: string | null; readonly questions: readonly InterviewQuestion[];
      readonly slot: InterviewSlot | null; readonly heldAt: string | null; readonly explanations: readonly InterviewExplanation[];
      readonly attachments: readonly InterviewNote[] }
  | { readonly kind: "notInvited" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export type InterviewWrite =
  | { readonly kind: "saved"; readonly explanation?: InterviewExplanation; readonly note?: InterviewNote }
  /** 409 on a note: the talk is held, notes are closed. */
  | { readonly kind: "closed" }
  | { readonly kind: "rejected" } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" }
  /** 404: the work is gone for this student; 403: the invitation no longer holds (or the request was refused). */
  | { readonly kind: "notFound" } | { readonly kind: "notInvited" };

export interface InterviewPort {
  read(documentId: string): Promise<InterviewRead>;
  explain(documentId: string, input: { readonly questionId: string | null; readonly text: string }): Promise<InterviewWrite>;
  /** Optional: without it the page hides the note action. */
  attachNote?(documentId: string, note: NoteUpload): Promise<InterviewWrite>;
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
      case "rejected": case "signedOut": case "notFound": case "notInvited": return { kind: answer.kind };
      default: return { kind: "unavailable" };
    }
  },
  async attachNote(documentId, note) {
    const answer = await sendInterviewNote(documentId, interviewNoteBody(note.fileName, note.mediaType, note.bytes), options);
    switch (answer.kind) {
      case "ok": return { kind: "saved", note: { id: answer.value.id, fileName: answer.value.fileName } };
      case "conflict": return { kind: "closed" };
      case "rejected": case "signedOut": case "notFound": case "notInvited": return { kind: answer.kind };
      default: return { kind: "unavailable" };
    }
  },
});

export const studentInterviewPort: InterviewPort = studentInterviewPortWith();
