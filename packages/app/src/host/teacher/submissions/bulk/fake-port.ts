// An in-memory server for the bulk download (WEB-1902; WEB-2004), invented data. Tests and the catalogue only.
import { bulkFilePath, type BulkCall, type BulkFormat } from "./contract";

export const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
export const TOKEN = "1763800000000.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-aBcDe";

export function fakeBulkServer(opts: { forbid?: boolean; expiresAt?: string } = {}) {
  const posts: { params?: unknown; body?: unknown }[] = [];
  const call: BulkCall = async (_id, input) => {
    posts.push({ params: input.params, body: input.body });
    if (opts.forbid === true) return { ok: false as const, status: 403, code: "forbidden" };
    const format = (input.body as { format: BulkFormat }).format;
    const assignmentId = input.params?.assignmentId ?? ASSIGNMENT;
    return {
      ok: true as const,
      status: 201,
      body: { format, downloadPath: `${bulkFilePath(assignmentId, format)}?token=${TOKEN}`, expiresAt: opts.expiresAt ?? "2099-12-01T12:00:00.000Z" },
    };
  };
  return { call, posts };
}
