// Teacher side of the interview preparation (SRV-1530, N-14): one function per operation of the
// generated contract. Every function answers with a closed outcome and never throws; there is
// deliberately no field for an outcome, grade, sanction or suspicion.
import { createApi, type ApiOptions, type ApiResult, type Input } from "./api";

type Body<T> = Extract<T, { ok: true }> extends { body: infer Shape } ? Shape : never;
export type InterviewPreparation = Body<ApiResult<"work.interview.get">>;
export type InterviewQuestion = InterviewPreparation["questions"][number];
export type InterviewAppointmentInput = Input<"work.interview-appointment.put">["body"];
export type InterviewPdf = Body<ApiResult<"work.interview-pdf.get">>;

export type InterviewOutcome<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "conflict" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unavailable" };

export type InterviewExplanation = Body<ApiResult<"work.interview-explanations.post">>;
/** The student's read: before the invitation the server answers 403, which is its own state, not an error. */
export type StudentInterviewOutcome<T> = InterviewOutcome<T> | { readonly kind: "notInvited" };

async function run<T>(request: () => Promise<{ ok: true; body: T } | { ok: false; status: number }>): Promise<InterviewOutcome<T>>;
async function run<T>(request: () => Promise<{ ok: true; body: T } | { ok: false; status: number }>, forbidden: "notInvited"): Promise<StudentInterviewOutcome<T>>;
async function run<T>(request: () => Promise<{ ok: true; body: T } | { ok: false; status: number }>, forbidden?: "notInvited"): Promise<StudentInterviewOutcome<T>> {
  try {
    const answer = await request();
    if (answer.ok) return { kind: "ok", value: answer.body };
    if (answer.status === 403 && forbidden !== undefined) return { kind: forbidden };
    switch (answer.status) {
      case 401: return { kind: "signedOut" };
      case 404: return { kind: "notFound" };
      case 409: return { kind: "conflict" };
      case 400: case 413: case 415: case 422: return { kind: "rejected" };
      default: return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

const none = { query: undefined } as const;

export const readInterview = (documentId: string, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview.get", { params: { documentId }, ...none, body: undefined }));

export const addInterviewQuestion = (documentId: string, input: { paragraphRef: string | null; questionText: string }, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-questions.post", { params: { documentId }, ...none, body: input }));

export const removeInterviewQuestion = (documentId: string, questionId: string, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-questions.delete", { params: { documentId, questionId }, ...none, body: undefined }));

export const inviteToInterview = (documentId: string, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-invite.post", { params: { documentId }, ...none, body: undefined }));

export const setInterviewAppointment = (documentId: string, body: InterviewAppointmentInput, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-appointment.put", { params: { documentId }, ...none, body }));

export const markInterviewHeld = (documentId: string, date: string, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-held.post", { params: { documentId }, ...none, body: { date } }));

export const readInterviewPdf = (documentId: string, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-pdf.get", { params: { documentId }, ...none, body: undefined }));

// The student's side (PIL-K-RAZGOVOR): the same read, owner_or_course_teacher, where 403 means not yet invited.
export const readInterviewAsStudent = (documentId: string, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview.get", { params: { documentId }, ...none, body: undefined }), "notInvited");

/** One explanation, up to 2000 characters; the answer is the explanation as the server stored it. */
export const sendInterviewExplanation = (documentId: string, input: { questionId: string | null; text: string }, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-explanations.post", { params: { documentId }, ...none, body: input }), "notInvited");

// PIL-K-RAZGOVOR-PRILOG (SRV #644): the owning student's note to the preparation, after the invitation.
export type InterviewNoteInput = Input<"work.interview-notes.post">["body"];
export type InterviewNote = Body<ApiResult<"work.interview-notes.post">>;
/** The contract's limit of one note in bytes (work.interview-notes.post, byteSize maximum). */
export const INTERVIEW_NOTE_MAX_BYTES = 1_048_576;

/** One note, a UTF-8 text or a PDF in Base64; 403 before the invitation, 409 once the interview is held. */
export const attachInterviewNote = (documentId: string, body: InterviewNoteInput, options?: ApiOptions) =>
  run(() => createApi(options)("work.interview-notes.post", { params: { documentId }, ...none, body }), "notInvited");
