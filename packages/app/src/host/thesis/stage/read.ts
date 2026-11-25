// WEB-V16-OBRANA: the read and the write of the stage, through the contract only (work.thesis-stage.get/put).
// A refusal is never an empty answer: 404 (another's work, or one without a mentorship), signed out and
// "unavailable" are states of their own.
import type { createApi } from "@/client/api";

import type { StageBody, StageView } from "./model";

type Api = ReturnType<typeof createApi>;
export type StageRead =
  | { readonly kind: "ok"; readonly view: StageView }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type StageWrite =
  | { readonly kind: "done"; readonly view: StageView }
  | { readonly kind: "signedOut" | "notFound" | "forbidden" | "invalid" }
  /** 503, a timeout, a broken connection: the change may have been recorded. */
  | { readonly kind: "unknown" };

type Wire = { readonly stage: StageView["stage"]; readonly defenseAt: string | null; readonly changedAt: string | null; readonly changedByPart: StageView["changedByPart"] };
const viewOf = (b: Wire): StageView => ({ stage: b.stage, defenseAt: b.defenseAt, changedAt: b.changedAt, changedByPart: b.changedByPart });
const signedOut = (r: { readonly code: string }) => r.code === "unauthorized" || r.code === "session_expired";
const notFound = (r: { readonly status: number; readonly code: string }) => r.status === 404 || r.code === "not_found";

async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try { return await run(); } catch { return null; }
}

export async function readStage(call: Api, documentId: string): Promise<StageRead> {
  const r = await attempt(() => call("work.thesis-stage.get", { params: { documentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (r.ok) return { kind: "ok", view: viewOf(r.body) };
  return signedOut(r) ? { kind: "signedOut" } : notFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
}

export async function writeStage(call: Api, documentId: string, body: StageBody): Promise<StageWrite> {
  const r = await attempt(() => call("work.thesis-stage.put", { params: { documentId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "done", view: viewOf(r.body) };
  if (signedOut(r)) return { kind: "signedOut" };
  if (notFound(r)) return { kind: "notFound" };
  if (r.status === 403) return { kind: "forbidden" };
  if (r.status === 422 || r.code === "client_rejected") return { kind: "invalid" };
  return { kind: "unknown" };
}
