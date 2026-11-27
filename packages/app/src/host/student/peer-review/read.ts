// WEB-V19-RECENZIJA-STUDENT: the reads and the one write of the student's peer review, through the contract
// only (student.peer-review-tasks.get, student.peer-review-work.get, student.peer-review.post,
// student.peer-reviews-received.get). A refusal is never an empty answer: "not found" (another course's,
// an unknown and a malformed id read the same), "signed out" and "unavailable" are states of their own.
import type { ApiOperationId, ApiResult, createApi, Input } from "@/client/api";

type Api = ReturnType<typeof createApi>;
type Body<Id extends ApiOperationId> = Extract<ApiResult<Id>, { ok: true }>["body"];

export type TasksView = Body<"student.peer-review-tasks.get">;
export type WorkView = Body<"student.peer-review-work.get">;
export type ReceivedView = Body<"student.peer-reviews-received.get">;
export type ReviewBody = NonNullable<Input<"student.peer-review.post">["body"]>;

export type Read<T> =
  | { readonly kind: "ok"; readonly view: T }
  | { readonly kind: "notFound" }
  | { readonly kind: "denied" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type SendOutcome =
  | { readonly kind: "done" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "closed" }
  | { readonly kind: "alreadyReviewed" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the review may have been recorded. */
  | { readonly kind: "unknown" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
export const isSignedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
export const isNotFound = (r: { readonly status: number; readonly code: string }) => r.status === 404 || r.code === "not_found";

/** The client rejects when the connection drops or the body cannot be read: "unavailable" for a read, "unknown" for a write. */
export async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

function refusal(r: { readonly status: number; readonly code: string }): "signedOut" | "notFound" | "denied" | "unavailable" {
  if (isSignedOut(r)) return "signedOut";
  if (r.status === 403) return "denied";
  return isNotFound(r) ? "notFound" : "unavailable";
}

export async function readTasks(call: Api, assignmentId: string): Promise<Read<TasksView>> {
  const r = await attempt(() => call("student.peer-review-tasks.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", view: r.body } : { kind: refusal(r) };
}

export async function readWork(call: Api, taskId: string): Promise<Read<WorkView>> {
  const r = await attempt(() => call("student.peer-review-work.get", { params: { taskId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", view: r.body } : { kind: refusal(r) };
}

export async function readReceived(call: Api, assignmentId: string): Promise<Read<ReceivedView>> {
  const r = await attempt(() => call("student.peer-reviews-received.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", view: r.body } : { kind: refusal(r) };
}

export async function sendReview(call: Api, taskId: string, body: ReviewBody): Promise<SendOutcome> {
  const r = await attempt(() => call("student.peer-review.post", { params: { taskId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "done" };
  if (isSignedOut(r)) return { kind: "signedOut" };
  if (isNotFound(r)) return { kind: "notFound" };
  if (r.code === "closed") return { kind: "closed" };
  if (r.code === "already_reviewed") return { kind: "alreadyReviewed" };
  if (r.code === "invalid_input" || r.code === "invalid_json" || r.code === "client_rejected") return { kind: "invalid" };
  return { kind: "unknown" };
}
