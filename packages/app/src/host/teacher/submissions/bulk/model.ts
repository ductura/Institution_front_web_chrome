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

export function requestFailure(outcome: BulkRequest): string {
  if (outcome.kind === "greska") return outcome.code === "forbidden" ? t.forbidden : t.notFound;
  return t.requestUnknown;
}
