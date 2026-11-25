// The reads of NF-5 PG-3, PG-7 and PG-9 beside the reads of "Pregled rada". Only operations of the contract extract,
// through the shared clients: work.origin-composition.get (PG-3), work.event-disputes.get (PG-7),
// the comment list and work.comment-drafts.get (PG-9). Every function never throws; a missing read is said, not guessed.
import { createApi } from "../../../../../../../src/client/api";
import { listComments, type ListOutcome } from "../../../../../../../src/client/comments";
import { createEventDisputes, type DisputeListOutcome } from "../../../../../../../src/client/event-disputes";
import type { OriginRead } from "../../provenance/origin";
import { readOrigin } from "../../../student/work/origin/read";
import type { DraftsRead } from "../../comment-bank/model";
import { draftCommentsPort } from "../../comment-bank/port";

export type SeenItem = { readonly kind: "comment" | "revision_request" | "milestone_revision" | "message"; readonly id: string; readonly firstSeenAt: string };
/** work.seen-by-student.get: only the caller's own items the student has opened. Not shown when the read fails. */
export type SeenRead = { readonly kind: "ready"; readonly items: readonly SeenItem[] } | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type ReviewExtras = {
  readonly composition: (documentId: string) => Promise<OriginRead>;
  readonly disputes: (documentId: string) => Promise<DisputeListOutcome>;
  readonly comments: (documentId: string) => Promise<ListOutcome>;
  readonly drafts: (documentId: string) => Promise<DraftsRead>;
  readonly seen: (documentId: string) => Promise<SeenRead>;
};

export async function readSeen(documentId: string): Promise<SeenRead> {
  const answer = await createApi()("work.seen-by-student.get", { params: { documentId }, query: undefined, body: undefined });
  if (answer.ok) return { kind: "ready", items: answer.body.items };
  if (answer.status === 401) return { kind: "signedOut" };
  return answer.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
}

const guard = <T,>(read: () => Promise<T>, fallback: T): Promise<T> => read().catch(() => fallback);

export const realExtras: ReviewExtras = {
  composition: (id) => guard(() => readOrigin(id), { kind: "unavailable" }),
  disputes: (id) => guard(() => createEventDisputes(createApi()).list(id), { kind: "unavailable" }),
  comments: (id) => guard(() => listComments(id), { kind: "unavailable" }),
  drafts: (id) => guard(() => draftCommentsPort.listDrafts(id), { kind: "unavailable" }),
  seen: (id) => guard(() => readSeen(id), { kind: "unavailable" }),
};
