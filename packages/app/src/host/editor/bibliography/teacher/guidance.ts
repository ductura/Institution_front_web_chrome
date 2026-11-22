/**
 * The teacher's source tools for one work (WEB-2133B, SRV-1605): reading the
 * guidance (recommended and mandatory sources, requested proofs, the review
 * mark) and the writes behind the Izvori buttons. Everything goes through the
 * generated client; a write answers "ok", "signedOut" or "failed".
 */
import { createApi } from "../../../../../../../src/client/api.ts";
import type { SourceDraft } from "@ductura/ui";

type Call = ReturnType<typeof createApi>;

export type Requirement = "recommended" | "required";
export type GuidanceSource = { id: string; label: string; requirement: Requirement | null; proofCount: number; createdAt: string };
export type ProofRequest = { id: string; sourceId: string; instruction: string; dueAt: string; closedAt: string | null };
export type Guidance = { canWrite: boolean; sources: GuidanceSource[]; requests: ProofRequest[]; seenAt: string | null };
export type GuidanceRead = { kind: "ready"; guidance: Guidance } | { kind: "signedOut" } | { kind: "unavailable" };
export type Proof = { id: string; page: string; note: string | null };
export type ProofsRead = { kind: "ready"; proofs: Proof[] } | { kind: "signedOut" } | { kind: "unavailable" };
export type WriteResult = "ok" | "signedOut" | "failed";

const failure = (status: number) => (status === 401 ? "signedOut" as const : "unavailable" as const);
const written = (r: { ok: boolean; status: number }): WriteResult => (r.ok ? "ok" : r.status === 401 ? "signedOut" : "failed");

export async function readGuidance(documentId: string, call: Call = createApi()): Promise<GuidanceRead> {
  try {
    const r = await call("teacher.source-guidance.get", { params: { documentId }, query: undefined, body: undefined });
    if (!r.ok) return { kind: failure(r.status) };
    const sources = r.body.sources.map((s) => ({
      id: s.id, label: s.record.title, requirement: s.requirement, proofCount: s.proofCount, createdAt: s.createdAt,
    }));
    return { kind: "ready", guidance: { canWrite: r.body.canWrite, sources, requests: r.body.proofRequests, seenAt: r.body.literatureSeenAt } };
  } catch {
    return { kind: "unavailable" };
  }
}

/** The confirmations a student attached to one source (read only; the excerpt image is not fetched here). */
export async function readProofs(documentId: string, sourceId: string, call: Call = createApi()): Promise<ProofsRead> {
  try {
    const r = await call("teacher.source-proofs.get", { params: { documentId, sourceId }, query: undefined, body: undefined });
    return r.ok ? { kind: "ready", proofs: r.body.proofs.map((p) => ({ id: p.id, page: p.page, note: p.note })) } : { kind: failure(r.status) };
  } catch {
    return { kind: "unavailable" };
  }
}

async function attempt(run: () => Promise<{ ok: boolean; status: number }>): Promise<WriteResult> {
  try {
    return written(await run());
  } catch {
    return "failed";
  }
}

/** Recommends (or marks mandatory) a new source for the work; the record gets a fresh id. */
export function recommendSource(documentId: string, draft: SourceDraft, requirement: Requirement, id: string, call: Call = createApi()) {
  return attempt(() => call("teacher.source-recommendation.put", {
    params: { documentId, sourceId: id }, query: undefined, body: { record: { id, ...draft }, requirement },
  }));
}

export const removeRecommendation = (documentId: string, sourceId: string, call: Call = createApi()) =>
  attempt(() => call("teacher.source-recommendation.delete", { params: { documentId, sourceId }, query: undefined, body: undefined }));

export const requestProof = (documentId: string, sourceId: string, instruction: string, dueAt: string, call: Call = createApi()) =>
  attempt(() => call("teacher.source-proof-request.put", { params: { documentId, sourceId }, query: undefined, body: { instruction, dueAt } }));

export const withdrawProof = (documentId: string, sourceId: string, call: Call = createApi()) =>
  attempt(() => call("teacher.source-proof-request.delete", { params: { documentId, sourceId }, query: undefined, body: undefined }));

export const markLiteratureSeen = (documentId: string, call: Call = createApi()) =>
  attempt(() => call("teacher.literature-seen.put", { params: { documentId }, query: undefined, body: undefined }));
