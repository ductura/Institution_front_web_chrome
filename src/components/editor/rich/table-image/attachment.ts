/**
 * Loading an image as a work attachment (E§3.3 Slika). The bytes go through
 * the client, never straight to a table; the document keeps only the
 * attachment id and the SHA-256 of the bytes (document v4 §5.2).
 *
 * The bytes go to `work.attachments.post` and are shown from
 * `work.attachments.get`, both through `createApi` (src/client/work-attachments.ts).
 * This module stays transport-free: a caller-supplied `post` sends the bytes and
 * returns what the server gave; `postViaApi` there builds that `post`.
 * The limits below are the server's (contract: png or jpeg, up to 5 MiB).
 */

import { isSourceId } from "@/domain/document/schema";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** `attachmentSha256`, when the server states it, must equal the hash of the bytes sent. */
export type AttachmentAnswer = { readonly attachmentId: string; readonly attachmentSha256?: string };
export type PostAttachment = (upload: { bytes: Uint8Array; type: string; sha256: string }) => Promise<AttachmentAnswer>;
export type Uploaded = { attachmentId: string; attachmentSha256: string };
export type UploadFailure = "type" | "empty" | "size" | "send";


export function checkFile(file: { type: string; size: number }): UploadFailure | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_IMAGE_BYTES) return "size";
  return null;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type UploadResult = { ok: true; value: Uploaded } | { ok: false; reason: UploadFailure };

export async function uploadImage(file: Blob, post: PostAttachment): Promise<UploadResult> {
  const bad = checkFile(file);
  if (bad) return { ok: false, reason: bad };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const answer = await post({ bytes, type: file.type, sha256 });
    if (!isSourceId(answer.attachmentId) || (answer.attachmentSha256 !== undefined && answer.attachmentSha256 !== sha256)) return { ok: false, reason: "send" };
    return { ok: true, value: { attachmentId: answer.attachmentId, attachmentSha256: sha256 } };
  } catch {
    return { ok: false, reason: "send" };
  }
}
