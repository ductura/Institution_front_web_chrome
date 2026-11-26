// WEB-V18-KODIRANJE-GRADIVO: the reads and writes of the student's material for qualitative coding, through
// the contract only (student.qual-materials.get|post, student.qual-material.get|delete). Another student's
// material reads as an unknown one (404). A refusal is never an empty list: "not found", "signed out" and
// "unavailable" are states of their own.
import type { createApi, Input } from "@/client/api";

type Api = ReturnType<typeof createApi>;
export type Kind = Input<"student.qual-materials.post">["body"]["kind"];

export type MaterialRow = {
  readonly id: string; readonly title: string; readonly kind: Kind; readonly createdOn: string;
  readonly charCount: number; readonly segmentCount: number; readonly locked: boolean;
};
export type Material = {
  readonly id: string; readonly title: string; readonly kind: Kind; readonly text: string; readonly createdOn: string;
  readonly segmentCount: number; readonly locked: boolean;
};
export type NewMaterial = { readonly title: string; readonly kind: Kind; readonly text: string };

export type ListRead =
  | { readonly kind: "ok"; readonly materials: readonly MaterialRow[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type OneRead =
  | { readonly kind: "ok"; readonly material: Material }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type AddOutcome =
  | { readonly kind: "saved"; readonly material: Material }
  | { readonly kind: "signedOut" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the material may have been recorded. */
  | { readonly kind: "unknown" };
export type RemoveOutcome =
  | { readonly kind: "removed" }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  /** 503, a timeout, a broken connection: the material may be gone. */
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

export async function readMaterials(call: Api): Promise<ListRead> {
  const r = await attempt(() => call("student.qual-materials.get", { params: undefined, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : { kind: "unavailable" };
  return { kind: "ok", materials: r.body.materials };
}

export async function readMaterial(call: Api, id: string): Promise<OneRead> {
  const r = await attempt(() => call("student.qual-material.get", { params: { id }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) {
    if (signedOut(r)) return { kind: "signedOut" };
    return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
  }
  return { kind: "ok", material: r.body };
}

export async function addMaterial(call: Api, body: NewMaterial): Promise<AddOutcome> {
  const r = await attempt(() => call("student.qual-materials.post", { params: undefined, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "saved", material: r.body };
  if (signedOut(r)) return { kind: "signedOut" };
  switch (r.code) {
    case "conflict": return { kind: "conflict" };
    case "invalid_input": case "invalid_json": case "client_rejected": case "unsupported_media_type": case "body_too_large": return { kind: "invalid" };
    default: return { kind: "unknown" };
  }
}

export async function removeMaterial(call: Api, id: string): Promise<RemoveOutcome> {
  const r = await attempt(() => call("student.qual-material.delete", { params: { id }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "removed" };
  if (signedOut(r)) return { kind: "signedOut" };
  return isNotFound(r) ? { kind: "notFound" } : { kind: "unknown" };
}
