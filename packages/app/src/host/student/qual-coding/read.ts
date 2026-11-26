// WEB-V18-KODIRANJE-OZNAKE: the reads and writes of the student's codebook and marked passages, through the
// contract only (student.qual-codes.*, student.qual-code.*, student.qual-segments.*, student.qual-segment.delete).
// Another student's code, material or segment reads as an unknown one (404). A refusal is never an empty list:
// "not found", "signed out" and "unavailable" are states of their own. Nothing here calls the helper (V18-3).
import type { createApi, Input } from "@/client/api";

type Api = ReturnType<typeof createApi>;

export type Code = { readonly id: string; readonly name: string; readonly description: string; readonly order: number };
export type Segment = {
  readonly id: string; readonly codeId: string; readonly paragraph: number; readonly start: number; readonly end: number;
  readonly quote: string; readonly memo: string | null; readonly createdOn: string;
};
export type Anchor = Input<"student.qual-segments.post">["body"]["anchor"];
export type NewCode = { readonly name: string; readonly description?: string };
export type CodePatch = { readonly name?: string; readonly description?: string; readonly order?: number };

export type CodesRead =
  | { readonly kind: "ok"; readonly codes: readonly Code[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type SegmentsRead =
  | { readonly kind: "ok"; readonly segments: readonly Segment[] }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
/** A write of a code or a segment. `unknown`: 503, a timeout or a broken connection, the write may have been kept. */
export type WriteOutcome<T> =
  | { readonly kind: "saved"; readonly value: T }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  | { readonly kind: "unknown" };
export type RemoveOutcome =
  | { readonly kind: "removed" }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  /** The server asks for a confirmation first (the code still has marked passages). */
  | { readonly kind: "needsConfirm" }
  | { readonly kind: "unknown" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
const isNotFound = (r: { readonly status: number; readonly code: string }) => r.status === 404 || r.code === "not_found";
const INVALID: ReadonlySet<string> = new Set(["invalid_input", "invalid_json", "client_rejected", "unsupported_media_type", "body_too_large"]);

async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

function failed<T>(r: { readonly status: number; readonly code: string }): WriteOutcome<T> {
  if (signedOut(r)) return { kind: "signedOut" };
  if (isNotFound(r)) return { kind: "notFound" };
  if (r.code === "conflict") return { kind: "conflict" };
  return INVALID.has(r.code) ? { kind: "invalid" } : { kind: "unknown" };
}

export async function readCodes(call: Api): Promise<CodesRead> {
  const r = await attempt(() => call("student.qual-codes.get", { params: undefined, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : { kind: "unavailable" };
  return { kind: "ok", codes: r.body.codes };
}

export async function addCode(call: Api, body: NewCode): Promise<WriteOutcome<Code>> {
  const r = await attempt(() => call("student.qual-codes.post", { params: undefined, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "saved", value: r.body } : failed(r);
}

export async function patchCode(call: Api, id: string, body: CodePatch): Promise<WriteOutcome<Code>> {
  const r = await attempt(() => call("student.qual-code.patch", { params: { id }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "saved", value: r.body } : failed(r);
}

/** First without `confirm`; when the code still has marked passages the server says conflict and the page asks, then calls again with `confirm`. */
export async function removeCode(call: Api, id: string, confirm: boolean): Promise<RemoveOutcome> {
  const r = await attempt(() => call("student.qual-code.delete", { params: { id }, query: confirm ? { confirm: "true" } : {}, body: undefined }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "removed" };
  if (signedOut(r)) return { kind: "signedOut" };
  if (isNotFound(r)) return { kind: "notFound" };
  return r.code === "conflict" && !confirm ? { kind: "needsConfirm" } : { kind: "unknown" };
}

export async function readSegments(call: Api, materialId: string): Promise<SegmentsRead> {
  const r = await attempt(() => call("student.qual-segments.get", { params: { id: materialId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) {
    if (signedOut(r)) return { kind: "signedOut" };
    return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
  }
  return { kind: "ok", segments: r.body.segments };
}

export async function addSegment(call: Api, materialId: string, body: { codeId: string; anchor: Anchor; memo?: string }): Promise<WriteOutcome<Segment>> {
  const r = await attempt(() => call("student.qual-segments.post", { params: { id: materialId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "saved", value: r.body } : failed(r);
}

export async function removeSegment(call: Api, id: string): Promise<RemoveOutcome> {
  const r = await attempt(() => call("student.qual-segment.delete", { params: { id }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "removed" };
  if (signedOut(r)) return { kind: "signedOut" };
  return isNotFound(r) ? { kind: "notFound" } : { kind: "unknown" };
}
