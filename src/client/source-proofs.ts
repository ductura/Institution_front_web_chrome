/**
 * Proofs from a source (WEB-1106; Val 11, E§3.4 proofs, B-8): a student puts a
 * cut-out of a source page beside a source of the work. The cut-out is made in
 * the browser (a PDF never leaves the device); only the JPEG of the chosen
 * rectangle, its page and an optional note are sent.
 *
 * Routes come from the contract (migration-contracts.generated.json, DAN-1558):
 * - student.source-proofs.get through createApi, which checks the answer;
 * - student.source-proofs.post is multipart, which createApi does not send, so
 *   the path is the contract's and the 201 is checked with responseMatches;
 * - student.source-proof-image.get answers a JPEG, read here as bytes.
 * An input that breaks a shape is never sent (`odbijeno`).
 */

import { browserTransport, createApi, responseMatches, type ApiResult } from "./api";
import migrationContracts from "./migration-contracts.generated.json" with { type: "json" };
import type { MigrationOperations } from "./migration-contract-types.generated";
import { matchesSchema, type Schema } from "./schema-check";

type ProofBody = MigrationOperations["student.source-proofs.get"]["success"]["body"]["proofs"][number];

/** A proof as the contract gives it (id, page, note, imagePath) and the source it was asked for. */
export type SourceProof = ProofBody & { readonly sourceId: string };

export type ProofDraft = {
  /** The cut-out, already encoded as JPEG by the browser. */
  readonly image: Blob;
  readonly page: string;
  readonly note?: string;
};

export type ProofFailure =
  | { readonly kind: "session-expired" }
  /** The server's refusal: nothing was stored. */
  | { readonly kind: "greska"; readonly code: "invalid" | "too_large" | "forbidden" | "not_found" }
  /** No answer, a broken connection or a shape outside the contract. */
  | { readonly kind: "nepoznato" };

export type ProofsRead = { readonly kind: "ok"; readonly proofs: readonly SourceProof[] } | ProofFailure;
export type ProofUpload =
  | { readonly kind: "ok"; readonly proof: SourceProof }
  /** The draft breaks the shape: nothing went on the wire. */
  | { readonly kind: "odbijeno" }
  | ProofFailure;
export type ProofImageRead = { readonly kind: "ok"; readonly image: Blob } | ProofFailure;

export type ProofsOptions = {
  readonly baseUrl?: string;
  /** Transport for tests; api.ts's browserTransport by default. */
  readonly transport?: typeof browserTransport;
};

/** Limits: page and note are the contract's; the image limit is the local proposal (the server checks again). */
export const PROOF_IMAGE_MAX_BYTES = 400_000;
export const PROOF_PAGE_MAX = 30;
export const PROOF_NOTE_MAX = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;
const JPEG = "image/jpeg";

const PROOFS_ROUTE = migrationContracts["student.source-proofs.get"];
const PROOF_ROUTE = migrationContracts["student.source-proofs.post"];
const PROOF_SCHEMA = PROOF_ROUTE.responses["201"].content["application/json"].schema as Schema;

/** The proofs route of one source of one work; null unless both are UUIDs. */
export function proofsPath(assignmentId: string, sourceId: string): string | null {
  if (!UUID.test(assignmentId) || !UUID.test(sourceId)) return null;
  return PROOFS_ROUTE.path.replace("{assignmentId}", assignmentId).replace("{sourceId}", sourceId);
}

/** The page as it is sent: trimmed, inner runs of space made one. */
export function normalPage(page: string): string {
  return page.trim().replace(/\s+/g, " ");
}

/** Whether a page fits the shape after `normalPage`. */
export function pageFits(page: string): boolean {
  const p = normalPage(page);
  return p.length >= 1 && p.length <= PROOF_PAGE_MAX && !/[\p{Cc}\p{Cf}]/u.test(p);
}

/** Whether a note fits: empty (left out) or up to PROOF_NOTE_MAX characters. */
export function noteFits(note: string | undefined): boolean {
  const n = note?.trim() ?? "";
  return n.length <= PROOF_NOTE_MAX && !/[\p{Cc}\p{Cf}]/u.test(n.replace(/\n/g, " "));
}

/**
 * Whether `imagePath` is a path under this proof's own route: same origin,
 * no `..`, no query, no other work or source. Anything else is not read.
 */
export function imagePathFits(imagePath: string, assignmentId: string, sourceId: string): boolean {
  const base = proofsPath(assignmentId, sourceId);
  if (base === null || !imagePath.startsWith(`${base}/`)) return false;
  const rest = imagePath.slice(base.length + 1).split("/");
  return rest.length >= 1 && rest.length <= 3 && rest.every((part) => SEGMENT.test(part) && part !== "." && part !== "..");
}

/** A proof the contract accepts that also has a path under this source's own route. */
function proofOf(body: ProofBody, assignmentId: string, sourceId: string): SourceProof | null {
  if (!imagePathFits(body.imagePath, assignmentId, sourceId)) return null;
  return { ...body, sourceId };
}

function failure(status: number): ProofFailure {
  switch (status) {
    case 401: return { kind: "session-expired" };
    case 400: case 422: return { kind: "greska", code: "invalid" };
    case 413: return { kind: "greska", code: "too_large" };
    case 403: return { kind: "greska", code: "forbidden" };
    case 404: return { kind: "greska", code: "not_found" };
    default: return { kind: "nepoznato" };
  }
}

const UNKNOWN = { kind: "nepoznato" } as const;

/** The proofs of one source, as the server keeps them. */
export async function listProofs(assignmentId: string, sourceId: string, options: ProofsOptions = {}): Promise<ProofsRead> {
  if (proofsPath(assignmentId, sourceId) === null) return { kind: "greska", code: "not_found" };
  const api = createApi({ baseUrl: options.baseUrl, fetchImpl: options.transport });
  try {
    const res: ApiResult<"student.source-proofs.get"> = await api("student.source-proofs.get", { params: { assignmentId, sourceId }, query: undefined, body: undefined });
    if (!res.ok) return res.status === 0 ? UNKNOWN : failure(res.status);
    const proofs = res.body.proofs.map((p) => proofOf(p, assignmentId, sourceId));
    if (proofs.some((p) => p === null)) return UNKNOWN;
    return { kind: "ok", proofs: proofs as SourceProof[] };
  } catch {
    return UNKNOWN;
  }
}

/** Whether the draft fits the shape: a non-empty JPEG within the limit, a page and a short note. */
export function draftFits(draft: ProofDraft): boolean {
  return draft.image.type === JPEG && draft.image.size > 0 && draft.image.size <= PROOF_IMAGE_MAX_BYTES
    && pageFits(draft.page) && noteFits(draft.note);
}

/**
 * Sends the cut-out and nothing else. The multipart body carries exactly
 * `image` (the JPEG), `page` and, when written, `note`; a draft that does not
 * fit is not sent. Success only on 201 with a proof of this source (B-6).
 */
export async function uploadProof(
  assignmentId: string, sourceId: string, draft: ProofDraft, options: ProofsOptions = {},
): Promise<ProofUpload> {
  const path = proofsPath(assignmentId, sourceId);
  if (path === null || !draftFits(draft)) return { kind: "odbijeno" };
  const form = new FormData();
  form.append("image", draft.image, "isjecak.jpg");
  form.append("page", normalPage(draft.page));
  const note = draft.note?.trim() ?? "";
  if (note !== "") form.append("note", note);
  const transport = options.transport ?? browserTransport;
  try {
    const res = await transport(new URL(path, options.baseUrl ?? globalThis.location.origin), {
      method: "POST", credentials: "include", redirect: "manual", headers: { accept: "application/json" }, body: form,
    });
    if (res.status !== 201) return failure(res.status);
    if (res.headers.get("content-type")?.startsWith("application/json") !== true) return UNKNOWN;
    const bytes = await res.arrayBuffer();
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!responseMatches("student.source-proofs.post", 201, body, bytes.byteLength) || !matchesSchema(PROOF_SCHEMA, body)) return UNKNOWN;
    const proof = proofOf(body as ProofBody, assignmentId, sourceId);
    return proof === null ? UNKNOWN : { kind: "ok", proof };
  } catch {
    return UNKNOWN;
  }
}

/** Whether bytes start as a JPEG does (SOI and a marker). */
export function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** The JPEG of one proof, only from a path under its own route. */
export async function readProofImage(proof: Pick<SourceProof, "imagePath">, assignmentId: string, sourceId: string, options: ProofsOptions = {}): Promise<ProofImageRead> {
  if (!imagePathFits(proof.imagePath, assignmentId, sourceId)) return { kind: "greska", code: "not_found" };
  const transport = options.transport ?? browserTransport;
  try {
    const res = await transport(new URL(proof.imagePath, options.baseUrl ?? globalThis.location.origin), {
      method: "GET", credentials: "include", redirect: "manual", headers: { accept: JPEG },
    });
    if (res.status !== 200) return failure(res.status);
    if (res.headers.get("content-type")?.split(";")[0]?.trim() !== JPEG) return UNKNOWN;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > PROOF_IMAGE_MAX_BYTES || !looksLikeJpeg(bytes)) return UNKNOWN;
    return { kind: "ok", image: new Blob([bytes], { type: JPEG }) };
  } catch {
    return UNKNOWN;
  }
}
