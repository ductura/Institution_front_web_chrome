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

async function run<T>(request: () => Promise<{ ok: true; body: T } | { ok: false; status: number }>): Promise<InterviewOutcome<T>> {
  try {
    const answer = await request();
    if (answer.ok) return { kind: "ok", value: answer.body };
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
