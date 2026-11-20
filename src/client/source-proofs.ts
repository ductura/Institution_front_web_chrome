/**
 * Proofs from a source (WEB-1106; Val 11, E§3.4 proofs, B-8): a student puts a
 * cut-out of a source page beside a source of the work. The cut-out is made in
 * the browser (a PDF never leaves the device); only the JPEG of the chosen
 * rectangle, its page and an optional note are sent.
 *
 * Routes (same origin, with the session cookie):
 * - GET  <proofs> with no body: 200 { proofs: SourceProof[] };
 * - POST <proofs> multipart { image, page, note? }: 201 SourceProof;
 * - GET  <imagePath> with no body: 200 image/jpeg.
 * where <proofs> is `student/assignments/{assignmentId}/sources/{sourceId}/proofs`
 * under SERVER_PREFIX.
 *
 * TODO(ugovor): the routes are not in @ductura/contracts yet (no SRV card on
 * the migration base). Multipart and a JPEG answer are outside what createApi
 * reads, so, like EditorPage.scope.ts, this module calls api.ts's
 * browserTransport and checks every answer against the closed local shapes
 * below. When the contract carries them, the shapes move there. An input that
 * breaks a shape is never sent (`odbijeno`).
 */

import { browserTransport, SERVER_PREFIX } from "./api";
import { matchesSchema, type Schema } from "./schema-check";

export type SourceProof = {
  readonly id: string;
  readonly sourceId: string;
  /** The page of the source the cut-out is from, as the student wrote it ("14", "xii"). */
  readonly page: string;
  readonly note: string | null;
  readonly createdAt: string;
  /** Bytes of the stored JPEG. */
  readonly size: number;
  /** Same-origin path of the JPEG, under this proof's own route. */
  readonly imagePath: string;
};

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

/** Limits of the local shape (proposal; the server checks them again). */
export const PROOF_IMAGE_MAX_BYTES = 400_000;
export const PROOF_PAGE_MAX = 20;
export const PROOF_NOTE_MAX = 500;
export const PROOFS_MAX = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;
const JPEG = "image/jpeg";

const UUID_SCHEMA: Schema = { type: "string", pattern: UUID.source };
const PROOF: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "sourceId", "page", "note", "createdAt", "size", "imagePath"],
  properties: {
    id: UUID_SCHEMA,
    sourceId: UUID_SCHEMA,
    page: { type: "string", minLength: 1, maxLength: PROOF_PAGE_MAX },
    note: { anyOf: [{ type: "null" }, { type: "string", minLength: 1, maxLength: PROOF_NOTE_MAX }] },
    createdAt: { type: "string", format: "date-time" },
    size: { type: "integer", minimum: 1, maximum: PROOF_IMAGE_MAX_BYTES },
    imagePath: { type: "string", minLength: 1, maxLength: 512 },
  },
};
const PROOFS: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["proofs"],
  properties: { proofs: { type: "array", maxItems: PROOFS_MAX, items: PROOF } },
};

/** The proofs route of one source of one work; null unless both are UUIDs. */
export function proofsPath(assignmentId: string, sourceId: string): string | null {
  if (!UUID.test(assignmentId) || !UUID.test(sourceId)) return null;
  return `${SERVER_PREFIX}student/assignments/${assignmentId}/sources/${sourceId}/proofs`;
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

/** A proof of the shape that also names this source and a path under its route. */
function proofOf(body: unknown, assignmentId: string, sourceId: string): SourceProof | null {
  if (!matchesSchema(PROOF, body)) return null;
  const proof = body as SourceProof;
  if (proof.sourceId !== sourceId || !imagePathFits(proof.imagePath, assignmentId, sourceId)) return null;
  return proof;
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

const isJson = (res: Response) => res.headers.get("content-type")?.startsWith("application/json") === true;
const UNKNOWN = { kind: "nepoznato" } as const;

/** The proofs of one source, oldest first as the server keeps them. */
export async function listProofs(assignmentId: string, sourceId: string, options: ProofsOptions = {}): Promise<ProofsRead> {
  const path = proofsPath(assignmentId, sourceId);
  if (path === null) return { kind: "greska", code: "not_found" };
  const transport = options.transport ?? browserTransport;
  try {
    const res = await transport(new URL(path, options.baseUrl ?? globalThis.location.origin), {
      method: "GET", credentials: "include", redirect: "manual", headers: { accept: "application/json" },
    });
    if (res.status !== 200) return failure(res.status);
    if (!isJson(res)) return UNKNOWN;
    const body: unknown = await res.json();
    if (!matchesSchema(PROOFS, body)) return UNKNOWN;
    const proofs = (body as { proofs: unknown[] }).proofs.map((p) => proofOf(p, assignmentId, sourceId));
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
    if (!isJson(res)) return UNKNOWN;
    const proof = proofOf(await res.json(), assignmentId, sourceId);
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
