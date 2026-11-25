// WEB-V19-RECENZIJA-NASTAVNIK: the teacher's reads and writes of one assignment's peer-review round, through the
// contract only (peer-review.round.get/put, peer-review.allocate.post, peer-review.teacher-overview.get,
// peer-review.review-withdrawal.post). A refusal is never an empty answer: "not found" (another course's,
// unknown and malformed ids read the same), "signed out" and "unavailable" are states of their own, and a write
// whose answer was lost is "unknown", never "done".
import type { ApiOperationId, ApiResult, createApi, Input } from "@/client/api";
import { attempt, isNotFound, isSignedOut } from "../../student/peer-review/read";

type Api = ReturnType<typeof createApi>;
type Body<Id extends ApiOperationId> = Extract<ApiResult<Id>, { ok: true }>["body"];

export type RoundView = Body<"peer-review.round.get">;
export type Round = NonNullable<RoundView["round"]>;
export type OverviewView = Body<"peer-review.teacher-overview.get">;
export type Allocation = OverviewView["allocations"][number];
export type RoundBody = Input<"peer-review.round.put">["body"];

export type Read<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type Write<T = undefined> =
  | { readonly kind: "done"; readonly value: T }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "already" }
  | { readonly kind: "tooFew" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the write may have been recorded. */
  | { readonly kind: "unknown" };

type Refusal = { readonly status: number; readonly code: string };

function failedRead(r: Refusal): { kind: "signedOut" | "notFound" | "unavailable" } {
  if (isSignedOut(r)) return { kind: "signedOut" };
  return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
}
function failedWrite(r: Refusal): { kind: "signedOut" | "notFound" | "already" | "tooFew" | "conflict" | "invalid" | "unknown" } {
  if (isSignedOut(r)) return { kind: "signedOut" };
  if (isNotFound(r)) return { kind: "notFound" };
  if (r.code === "already_allocated") return { kind: "already" };
  if (r.code === "too_few_submissions") return { kind: "tooFew" };
  if (r.code === "conflict") return { kind: "conflict" };
  if (r.code === "invalid_input" || r.code === "invalid_json" || r.code === "client_rejected") return { kind: "invalid" };
  return { kind: "unknown" };
}

export async function readRound(call: Api, assignmentId: string): Promise<Read<RoundView>> {
  const r = await attempt(() => call("peer-review.round.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", value: r.body } : failedRead(r);
}

export async function putRound(call: Api, assignmentId: string, body: RoundBody): Promise<Write<Round>> {
  const r = await attempt(() => call("peer-review.round.put", { params: { assignmentId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "done", value: r.body.round } : failedWrite(r);
}

export async function allocate(call: Api, assignmentId: string): Promise<Write<number>> {
  const r = await attempt(() => call("peer-review.allocate.post", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "done", value: r.body.allocated } : failedWrite(r);
}

export async function readOverview(call: Api, assignmentId: string): Promise<Read<OverviewView>> {
  const r = await attempt(() => call("peer-review.teacher-overview.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", value: r.body } : failedRead(r);
}

export async function withdrawReview(call: Api, assignmentId: string, reviewId: string, reason: string): Promise<Write> {
  const r = await attempt(() => call("peer-review.review-withdrawal.post", { params: { assignmentId, reviewId }, query: undefined, body: { reason } }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "done", value: undefined } : failedWrite(r);
}
