import type { RevisionRequest } from "@/client/revision-requests";

/**
 * "Dnevnik dorade" (E 3.3): who did what and when, derived from the separate
 * revision request records (ARCHITECTURE 5a), oldest first. Nothing is read
 * from the document; the private notes of the teacher are never part of it (D-130).
 */
export type LogKind = "opened" | "responded" | "declined" | "accepted" | "reopened" | "withdrawn";

export type LogEntry = { key: string; kind: LogKind; by: "teacher" | "student"; at: string; round: number };

export function revisionLog(requests: readonly RevisionRequest[]): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const request of requests) {
    for (const v of request.versions) {
      const key = `${request.id}:${v.version}`;
      entries.push({ key: `${key}:o`, kind: v.version === 1 ? "opened" : "reopened", by: "teacher", at: v.openedWindow, round: v.version });
      if (v.response) {
        entries.push({
          key: `${key}:r`, kind: v.response.kind === "declined" ? "declined" : "responded", by: "student",
          at: v.response.window, round: v.version,
        });
      }
      if (v.closed && v.closed.as !== "reopened") {
        entries.push({ key: `${key}:c`, kind: v.closed.as, by: "teacher", at: v.closed.window, round: v.version });
      }
    }
  }
  return entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
