import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import type { BulkRead, BulkRequest, BulkStatus } from "./contract";
import { bulkText as t } from "./messages.hr";

/** What the screen shows for a status at a given time; expiry is the server's timestamp against `now`. */
export type BulkView =
  | { readonly kind: "empty" }
  | { readonly kind: "idle" }
  | { readonly kind: "preparing" }
  | { readonly kind: "ready"; readonly href: string; readonly until: string }
  | { readonly kind: "expired" };

export function viewOf(status: BulkStatus, now: Date): BulkView {
  switch (status.state) {
    case "empty": return { kind: "empty" };
    case "idle": return { kind: "idle" };
    case "preparing": return { kind: "preparing" };
    default:
      return Date.parse(status.expiresAt) <= now.getTime()
        ? { kind: "expired" }
        : { kind: "ready", href: status.href, until: formatDateTimeHr(status.expiresAt) };
  }
}

export function failureMessage(read: BulkRead | BulkRequest): string {
  if (read.kind === "greska") return read.code === "forbidden" ? t.forbidden : t.notFound;
  return t.unavailable;
}

export const requestFailure = (outcome: BulkRequest): string =>
  outcome.kind === "nepoznato" ? t.requestUnknown : failureMessage(outcome);
