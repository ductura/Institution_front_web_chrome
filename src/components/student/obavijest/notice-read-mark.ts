import { createApi } from "@/client/api";

// WEB-12 (PO-7): the notice screen tells the server once that the student
// opened this version of the notice, over student.notice-read.post. It is a
// mark, not the acknowledgment: it opens no evidence (mayRecord stays with
// the acknowledgment) and a failure never stops the student reading. The
// server answers the first time it recorded, so a repeat changes nothing.
export type NoticeReadMark =
  | { kind: "read"; at: string }
  | { kind: "stale" | "signedOut" | "notFound" | "invalid" | "unavailable" };

type Api = ReturnType<typeof createApi>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isInstant(value: string): boolean {
  const ms = Date.parse(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value;
}

/** Marks the shown version read; nothing is sent for a malformed id or version. */
export async function markNoticeRead(assignmentId: string, versionNo: number, api: Api = createApi()): Promise<NoticeReadMark> {
  if (!UUID.test(assignmentId) || !Number.isInteger(versionNo) || versionNo < 1) return { kind: "invalid" };
  let result: Awaited<ReturnType<Api>>;
  try {
    result = await api("student.notice-read.post", { params: { assignmentId }, query: undefined, body: { versionNo } });
  } catch {
    return { kind: "unavailable" };
  }
  if (result.ok) {
    const at = (result.body as { readAt: string }).readAt;
    return isInstant(at) ? { kind: "read", at } : { kind: "unavailable" };
  }
  // 409: the assignment has a newer version than the one on the screen.
  if (result.status === 409) return { kind: "stale" };
  if (result.status === 401) return { kind: "signedOut" };
  if (result.status === 404) return { kind: "notFound" };
  if (result.code === "client_rejected" || [400, 403, 408, 413, 415, 422].includes(result.status)) return { kind: "invalid" };
  return { kind: "unavailable" };
}
