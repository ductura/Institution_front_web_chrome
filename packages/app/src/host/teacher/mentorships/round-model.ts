// WEB-NF6-RUNDA (NF-6 MK-8): the pure lines of "Pregled runde" for a mentor. What is new comes from
// work.changes-since-review.get, the requests on the text from collaboration.revision-requests (list).
// A failed read says "nedostupno"; nothing is ranked, scored or concluded about authorship.
import type { RevisionListOutcome } from "../../../../../../src/client/revision-requests";

import type { ChangesRead } from "../changes-since-review/model";
import { roundText as t } from "./messages.hr";

export function newsLine(read: ChangesRead): string {
  if (read.kind !== "ready") return t.newsUnavailable;
  const s = read.snapshot;
  if (s.reviewedRevision === null) return t.neverReviewed;
  if (!s.changed) return t.noChange;
  const text = s.blocks.filter((b) => b.kind !== "heading");
  return t.changed(text.filter((b) => b.change === "added").length, text.filter((b) => b.change === "removed").length);
}

export function requestsLine(read: RevisionListOutcome): string {
  if (read.kind !== "ok") return t.requestsUnavailable;
  const live = read.requests.filter((r) => r.state !== "withdrawn");
  if (live.length === 0) return t.noRequests;
  const count = (...states: string[]) => live.filter((r) => states.includes(r.state)).length;
  return t.requests(count("open", "reopened"), count("responded"), count("accepted"));
}

/** One item of work.seen-by-student.get: what the student first opened, and when. */
export type SeenItem = { readonly kind: string; readonly id: string; readonly firstSeenAt: string };

/**
 * #631 review 2, point 3: how many of the mentor's live requests on the text the student has seen. null when
 * either read failed or there is no request; the return of the whole work is not in that route.
 */
export function seenLine(read: RevisionListOutcome, seen: readonly SeenItem[] | null): string | null {
  if (read.kind !== "ok") return null;
  const live = read.requests.filter((r) => r.state !== "withdrawn");
  if (live.length === 0) return null;
  if (seen === null) return t.seenUnavailable;
  const ids = new Set(seen.filter((i) => i.kind === "revision_request").map((i) => i.id));
  return t.seen(live.filter((r) => ids.has(r.id)).length, live.length);
}
