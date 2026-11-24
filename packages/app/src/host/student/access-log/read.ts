// WEB-2113: the student host's own copy of src/components/student/access-log-read.ts.
import type { createApi } from "@/client/api";

import { accessLogDaysOf, type AccessLogDay } from "./days";

/**
 * WEB-13 (S-42 over /api/v1): the student's own access log, through the
 * contract only. The page knows the assignment; student.access-log.get wants
 * the work (documentId). The contract has no read-only route from one to the
 * other, and evidence.open.post opens the document and has side effects, so
 * it is never used for this (orchestrator, #87 c.7010793472). Until the
 * server adds that route the page shows the log as unavailable without any
 * call; readAccessLogPage is the read it will use. Another student's work,
 * an unknown one and a refusal read the same "not found" (C-23).
 */

type Api = ReturnType<typeof createApi>;

/** The cursor of the address: `prije` and `zapis`, both or none. */
export type AccessLogCursor = { readonly beforeAt: string; readonly beforeId: string };

export type AccessLogRead =
  | { readonly kind: "ok"; readonly days: AccessLogDay[]; readonly next: AccessLogCursor | null; readonly continued: boolean }
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

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);

/** One page of the log of the work `documentId`; `read` is createApi(). */
export async function readAccessLogPage(read: Api, documentId: string, cursor: AccessLogCursor | null): Promise<AccessLogRead> {
  const log = await read("student.access-log.get", {
    params: { documentId },
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
