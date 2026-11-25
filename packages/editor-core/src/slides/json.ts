// WEB-V13-MODEL-KLIJENT (val 13): the JCS snapshot, the hash and equality of a
// slides document, and the reading of `documentKind` from an `evidence.open`
// answer. Mirror of server/domain/slides/snapshot.ts; same bytes, same hash.
// Hashing is WebCrypto (as for text documents), so the hash functions are async.
import { canonicalizeJcs } from "../document/forensics/jcs";
import { isPlainObject, ownProperty } from "../document/json";

import { DOCUMENT_KINDS, MAX_SLIDES_SNAPSHOT_BYTES, type DocumentKind, type SlidesDocument } from "./model";
import { validateSlidesDocument } from "./validate";

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 (lowercase hex) of bytes, or of the UTF-8 bytes of a text. */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) throw new Error("slides: Web Crypto unavailable");
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return hex(new Uint8Array(await subtle.digest("SHA-256", bytes as BufferSource)));
}

/** Number of UTF-8 bytes of a text. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export type SlidesSnapshotVerification =
  | { ok: true; document: SlidesDocument; text: string; sha256: string }
  | { ok: false; reason: "too_large" | "invalid" };

/** The JCS (RFC 8785) text of a slides document. */
export function slidesSnapshotText(doc: SlidesDocument): string {
  return canonicalizeJcs(doc);
}

/** UTF-8 bytes of the JCS text: what is hashed, signed and sent. */
export function slidesSnapshotBytes(doc: SlidesDocument): Uint8Array {
  return new TextEncoder().encode(slidesSnapshotText(doc));
}

/** SHA-256 (lowercase hex) of the UTF-8 bytes of the JCS text. */
export async function slidesSnapshotSha256(doc: SlidesDocument): Promise<string> {
  return sha256Hex(slidesSnapshotText(doc));
}

/**
 * A snapshot is accepted only as the exact JCS bytes of a valid slides
 * document: strict UTF-8 with no byte order mark, a document the validator
 * accepts, and a canonical form identical to the received text.
 */
export async function verifySlidesSnapshot(bytes: Uint8Array): Promise<SlidesSnapshotVerification> {
  if (!(bytes instanceof Uint8Array)) return { ok: false, reason: "invalid" };
  if (bytes.byteLength > MAX_SLIDES_SNAPSHOT_BYTES) return { ok: false, reason: "too_large" };
  const received = new Uint8Array(bytes);
  let text: string;
  let parsed: unknown;
  try {
    // ignoreBOM keeps a mark as a character, which then fails the JCS check.
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(received);
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const valid = validateSlidesDocument(parsed);
  if (!valid.ok) return { ok: false, reason: "invalid" };
  let canonical: string;
  try {
    canonical = canonicalizeJcs(valid.doc);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (canonical !== text) return { ok: false, reason: "invalid" };
  return { ok: true, document: valid.doc, text, sha256: await sha256Hex(received) };
}

/** Equality of two slides documents: same canonical bytes (ids are identity). */
export function slidesDocumentsEqual(a: SlidesDocument, b: SlidesDocument): boolean {
  return slidesSnapshotText(a) === slidesSnapshotText(b);
}

export type DocumentKindReading = { ok: true; kind: DocumentKind } | { ok: false };

/**
 * Reads `documentKind` from an `evidence.open` (or `live.document.get`,
 * `work.version.get`) answer. A client without the field treats the work as
 * text (the field is absent on older servers and on text works); a value
 * outside the closed list is refused, never guessed (the server answers 422
 * for it, so an unknown value on the wire is a broken answer, not a new kind).
 */
export function readDocumentKind(answer: unknown): DocumentKindReading {
  if (!isPlainObject(answer)) return { ok: false };
  if (!Object.prototype.hasOwnProperty.call(answer, "documentKind")) return { ok: true, kind: "text" };
  const value = ownProperty(answer, "documentKind");
  if (typeof value === "string" && (DOCUMENT_KINDS as readonly string[]).includes(value)) {
    return { ok: true, kind: value as DocumentKind };
  }
  return { ok: false };
}
