// WEB-V18-UPITNIK-ISPUNJAVANJE: the reads and the one write of the student's questionnaires, through the
// contract only (student.questionnaires.get, student.questionnaire.get, student.questionnaire-responses.post).
// An unknown, closed or someone else's questionnaire is the same 404. A refusal is never an empty list:
// "not found", "signed out" and "unavailable" are states of their own.
import type { createApi, Input } from "@/client/api";

type Api = ReturnType<typeof createApi>;
export type Row = { readonly id: string; readonly courseId: string; readonly title: string; readonly participated: boolean };
type QuestionList = readonly {
  readonly id: string; readonly order: number; readonly kind: "single" | "multiple" | "scale" | "number" | "text"; readonly text: string;
  readonly options: readonly { readonly code: string; readonly label: string }[] | null;
  readonly scale: { readonly min: number; readonly max: number } | null;
}[];
export type Form = Row & { readonly questions: QuestionList };
export type Sheet = Input<"student.questionnaire-responses.post">["body"];

export type ListRead =
  | { readonly kind: "ok"; readonly questionnaires: readonly Row[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type FormRead =
  | { readonly kind: "ok"; readonly form: Form }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type SendOutcome =
  | { readonly kind: "saved" }
  | { readonly kind: "signedOut" }
  /** 409: this student has already filled it in. */
  | { readonly kind: "conflict" }
  /** 404: closed, unknown or not this student's. */
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid" }
  /** 503, a refused origin, a timeout, a broken connection: the sheet may have been recorded. */
  | { readonly kind: "unknown" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
const isNotFound = (r: { readonly status: number; readonly code: string }) => r.status === 404 || r.code === "not_found";

/** The client rejects when the connection drops or the body cannot be read. */
async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export async function readList(call: Api): Promise<ListRead> {
  const r = await attempt(() => call("student.questionnaires.get", { params: undefined, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : { kind: "unavailable" };
  return { kind: "ok", questionnaires: r.body.questionnaires };
}

export async function readForm(call: Api, id: string): Promise<FormRead> {
  const r = await attempt(() => call("student.questionnaire.get", { params: { id }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) {
    if (signedOut(r)) return { kind: "signedOut" };
    return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
  }
  return { kind: "ok", form: r.body };
}

export async function sendSheet(call: Api, id: string, body: Sheet): Promise<SendOutcome> {
  const r = await attempt(() => call("student.questionnaire-responses.post", { params: { id }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "saved" };
  if (signedOut(r)) return { kind: "signedOut" };
  if (r.status === 409) return { kind: "conflict" };
  if (isNotFound(r)) return { kind: "notFound" };
  if (r.status === 400 || r.status === 413 || r.status === 415 || r.status === 422) return { kind: "invalid" };
  return { kind: "unknown" };
}
