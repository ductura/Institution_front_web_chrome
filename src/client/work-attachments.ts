/**
 * F4-PM1-R03: an image of a work goes to `work.attachments.post` and is shown from
 * `work.attachments.get`, both through `createApi`. The bytes travel as base64 in the body; the server
 * answers with the id and the sha256 of what it stored. Nothing here writes to a table: only the route.
 */
import type { createApi } from "./api";
import type { MigrationOperations } from "./migration-contract-types.generated";

type Call = ReturnType<typeof createApi>;
export type StoredAttachment = MigrationOperations["work.attachments.post"]["success"]["body"];
export type PostBytes = (upload: { bytes: Uint8Array; type: string; sha256: string }) => Promise<{ attachmentId: string; attachmentSha256: string }>;

export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

/** The `post` for `uploadImage`: sends the bytes of one assignment. Any refusal throws, so the upload says "send". */
export function postViaApi(call: Call, assignmentId: string): PostBytes {
  return async ({ bytes, type, sha256 }) => {
    const sent = await call("work.attachments.post", { params: { assignmentId }, query: undefined, body: { imageBase64: toBase64(bytes) } });
    if (!sent.ok) throw new Error(`attachment_${sent.status}`);
    const stored = sent.body;
    // The server decides the type from the bytes; a different type or hash than we sent is not our image.
    if (stored.mediaType !== type || stored.attachmentSha256 !== sha256) throw new Error("attachment_mismatch");
    return { attachmentId: stored.attachmentId, attachmentSha256: stored.attachmentSha256 };
  };
}

export type AttachmentRead =
  | { readonly kind: "ready"; readonly bytes: Uint8Array; readonly mediaType: "image/png" | "image/jpeg"; readonly sha256: string; readonly pixelWidth: number | null; readonly pixelHeight: number | null }
  | { readonly kind: "signedOut" | "notFound" | "unavailable" };

/** One image for display, as bytes with their type (the view makes its own Blob). Another person's attachment is `notFound` (404), never an empty picture. */
export async function readAttachment(call: Call, attachmentId: string): Promise<AttachmentRead> {
  try {
    const read = await call("work.attachments.get", { params: { attachmentId }, query: undefined, body: undefined });
    if (!read.ok) return { kind: read.status === 401 ? "signedOut" : read.status === 404 ? "notFound" : "unavailable" };
    const b = read.body;
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b.imageBase64) || b.attachmentId !== attachmentId) return { kind: "unavailable" };
    return { kind: "ready", bytes: fromBase64(b.imageBase64), mediaType: b.mediaType, sha256: b.attachmentSha256, pixelWidth: b.pixelWidth, pixelHeight: b.pixelHeight };
  } catch {
    return { kind: "unavailable" };
  }
}
