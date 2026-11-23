import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import type { BulkLink, BulkRequest } from "./contract";
import { bulkText as t } from "./messages.hr";

/** What the screen shows for a link at a given time; expiry is the server's timestamp against `now`. */
export type BulkView =
  | { readonly kind: "ready"; readonly href: string; readonly until: string }
  | { readonly kind: "expired" };

export function viewOf(link: BulkLink, now: Date): BulkView {
  return Date.parse(link.expiresAt) <= now.getTime()
    ? { kind: "expired" }
    : { kind: "ready", href: link.href, until: formatDateTimeHr(link.expiresAt) };
}

/** The longest delay a browser timer takes; a later expiry is checked again when that timer fires. */
const MAX_TIMER_MS = 2_147_483_647;

/** Milliseconds until the screen must show the link as expired (0 when it already is), for one timer. */
export function msUntilExpiry(link: BulkLink, now: Date): number {
  return Math.min(MAX_TIMER_MS, Math.max(0, Date.parse(link.expiresAt) - now.getTime()));
}

/** Whether a click on the link may go to the server: only while it is ready, so an expired link is never followed. */
export const mayFollow = (link: BulkLink, now: Date): boolean => viewOf(link, now).kind === "ready";

export function requestFailure(outcome: BulkRequest): string {
  if (outcome.kind === "greska") return outcome.code === "forbidden" ? t.forbidden : t.notFound;
  return t.requestUnknown;
}
