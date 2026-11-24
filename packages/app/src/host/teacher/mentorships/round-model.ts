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
