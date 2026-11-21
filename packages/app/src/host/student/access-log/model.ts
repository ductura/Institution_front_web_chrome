// Pure rules of "Tko je otvorio moj rad" (WEB-1707; plan M10.4, D-274 MQ10, PRODUCT §5 rule 17). Days of
// Europe/Zagreb, newest first, one row of five minutes per stored opening. Nothing is summed, counted or
// timed: there is no total, no duration and no number of visits. No server route is called here; the port is
// the smallest contract the plan implies (a probe answer stands in for it in the tests).
import { accessLogDaysOf, type AccessLogDay, type AccessLogEntry } from "../../../../../../src/components/student/access-log-days.ts";

export type AccessLogCursor = { readonly beforeAt: string; readonly beforeId: string };

export type WhoOpenedRead =
  | { readonly kind: "ok"; readonly entries: readonly AccessLogEntry[]; readonly next: AccessLogCursor | null }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface WhoOpenedPort {
  read(workId: string, cursor: AccessLogCursor | null): Promise<WhoOpenedRead>;
}

export type WhoOpenedView =
  | { readonly kind: "ready"; readonly days: readonly AccessLogDay[]; readonly next: AccessLogCursor | null }
  | { readonly kind: "empty" }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export function whoOpenedView(read: WhoOpenedRead): WhoOpenedView {
  if (read.kind !== "ok") return { kind: read.kind };
  const days = accessLogDaysOf(read.entries);
  return days.length === 0 ? { kind: "empty" } : { kind: "ready", days, next: read.next };
}

/** Reads through the port; a failure is "unavailable", never a made-up value. */
export async function loadWhoOpened(port: WhoOpenedPort, workId: string, cursor: AccessLogCursor | null = null): Promise<WhoOpenedView> {
  try {
    return whoOpenedView(await port.read(workId, cursor));
  } catch {
    return { kind: "unavailable" };
  }
}
