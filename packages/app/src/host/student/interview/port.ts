// Student side of the interview preparation (PIL-K-RAZGOVOR, N-14). The page talks only to this port;
// the real one answers through src/client/work-interview.ts (work.interview.get,
// work.interview-explanations.post and, since PIL-K-RAZGOVOR-PRILOG, work.interview-notes.post), the
// fake one (fake-port.ts) through memory for the tests.
// There is deliberately no field for an outcome, grade, sanction or suspicion.
import {
  attachInterviewNote, INTERVIEW_NOTE_MAX_BYTES, readInterviewAsStudent, sendInterviewExplanation,
  type InterviewExplanation as Stored, type InterviewNoteInput, type InterviewPreparation,
} from "../../../../../../src/client/work-interview";
import type { ApiOptions } from "../../../../../../src/client/api";

/** The contract's limits of a note (work.interview-notes.post): a text or a PDF of at most 1 MiB. */
export const NOTE_MAX_BYTES = INTERVIEW_NOTE_MAX_BYTES;
export const NOTE_FORMATS = [".pdf", ".txt"] as const;
export const NOTE_NAME_MAX = 200;
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
  | { readonly kind: "saved"; readonly explanation?: InterviewExplanation; readonly note?: string }
  | { readonly kind: "rejected" } | { readonly kind: "held" } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" }
  /** 404: the work is gone for this student; 403: the invitation no longer holds (or the request was refused). */
  | { readonly kind: "notFound" } | { readonly kind: "notInvited" };

export interface InterviewPort {
  read(documentId: string): Promise<InterviewRead>;
  explain(documentId: string, input: { readonly questionId: string | null; readonly text: string }): Promise<InterviewWrite>;
  /** Absent in a port without the notes route; the page then hides the field. */
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

/** The note's media type by its extension; null for a type the contract does not take. */
export function noteMediaType(fileName: string): InterviewNoteInput["mediaType"] | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  return lower.endsWith(".txt") ? "text/plain" : null;
}

/** Standard Base64 of the file's bytes, in chunks so a 1 MiB note does not overflow the call stack. */
export async function base64Of(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The body of one note, or null when the file cannot be one (the model checks the same before sending). */
export async function noteBody(file: File): Promise<InterviewNoteInput | null> {
  const fileName = file.name.trim();
  const mediaType = noteMediaType(fileName);
  if (mediaType === null || fileName.length > NOTE_NAME_MAX || file.size === 0 || file.size > NOTE_MAX_BYTES) return null;
  return { fileName, mediaType, contentBase64: await base64Of(file) };
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
  async attachNote(documentId, file) {
    const body = await noteBody(file);
    if (body === null) return { kind: "rejected" };
    const answer = await attachInterviewNote(documentId, body, options);
    switch (answer.kind) {
      // The server's name of the note: it is listed only once the server confirms it.
      case "ok": return { kind: "saved", note: answer.value.fileName };
      case "conflict": return { kind: "held" };
      case "rejected": case "signedOut": return { kind: answer.kind };
      default: return { kind: "unavailable" };
    }
  },
});

export const studentInterviewPort: InterviewPort = studentInterviewPortWith();
