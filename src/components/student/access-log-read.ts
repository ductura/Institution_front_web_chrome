import type { createApi } from "@/client/api";

import { accessLogDaysOf, type AccessLogDay } from "./access-log-days";

/**
 * WEB-13 (S-42 over /api/v1): the student's own access log, read in the
 * browser through the contract only. The page knows the assignment; the log
 * route wants the work, so the work is found with evidence.open.post without
 * `start`, which never makes a work, then student.access-log.get reads one
 * page. evidence.open wants Same Origin and `ductus-protocol: 1`, which only
 * the browser sends, so both reads run there. Another student's work, an
 * unknown one and a refusal read the same "not found" (C-23).
 */

type Api = ReturnType<typeof createApi>;

/** The cursor of the address: `prije` and `zapis`, both or none. */
export type AccessLogCursor = { readonly beforeAt: string; readonly beforeId: string };

export type AccessLogRead =
  | { readonly kind: "ok"; readonly days: AccessLogDay[]; readonly next: AccessLogCursor | null; readonly continued: boolean }
  | { readonly kind: "notStarted" }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The assignment id of the address in lower case, or null when it is not a UUID. */
export function assignmentIdOf(raw: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return UUID.test(value) ? value.toLowerCase() : null;
}

/** The cursor of the address when both parts are single strings; the server ignores a malformed one. */
export function cursorOf(query: Readonly<Record<string, string | string[] | undefined>>): AccessLogCursor | null {
  const { prije, zapis } = query;
  return typeof prije === "string" && typeof zapis === "string" ? { beforeAt: prije, beforeId: zapis } : null;
}

/** The address of a page of the log, from its cursor. */
export function pageHref(here: string, cursor: AccessLogCursor | null): string {
  if (cursor === null) return here;
  return `${here}?${new URLSearchParams({ prije: cursor.beforeAt, zapis: cursor.beforeId }).toString()}`;
}

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthenticated", "unauthorized", "session_expired"]);

/**
 * One page of the log for `assignmentId`. `open` is createApi with protocol
 * "1" (evidence.open.post), `read` is createApi without it.
 */
export async function readAccessLog(open: Api, read: Api, assignmentId: string, cursor: AccessLogCursor | null): Promise<AccessLogRead> {
  const work = await open("evidence.open.post", { params: undefined, query: undefined, body: { assignmentId } });
  if (!work.ok) {
    if (SIGNED_OUT.has(work.code)) return { kind: "signedOut" };
    if (work.code === "not_started") return { kind: "notStarted" };
    if (work.status === 403 || work.status === 404 || work.status === 409) return { kind: "notFound" };
    return { kind: "unavailable" };
  }
  const log = await read("student.access-log.get", {
    params: { documentId: work.body.documentId },
    query: cursor === null ? {} : { beforeAt: cursor.beforeAt, beforeId: cursor.beforeId },
    body: undefined,
  });
  if (!log.ok) {
    if (SIGNED_OUT.has(log.code)) return { kind: "signedOut" };
    if (log.status === 403 || log.status === 404) return { kind: "notFound" };
    return { kind: "unavailable" };
  }
  return { kind: "ok", days: accessLogDaysOf(log.body.entries), next: log.body.next, continued: log.body.continued };
}
