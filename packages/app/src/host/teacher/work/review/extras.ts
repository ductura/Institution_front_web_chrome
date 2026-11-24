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

export type ReviewExtras = {
  readonly composition: (documentId: string) => Promise<OriginRead>;
  readonly disputes: (documentId: string) => Promise<DisputeListOutcome>;
  readonly comments: (documentId: string) => Promise<ListOutcome>;
  readonly drafts: (documentId: string) => Promise<DraftsRead>;
};

const guard = <T,>(read: () => Promise<T>, fallback: T): Promise<T> => read().catch(() => fallback);

export const realExtras: ReviewExtras = {
  composition: (id) => guard(() => readOrigin(id), { kind: "unavailable" }),
  disputes: (id) => guard(() => createEventDisputes(createApi()).list(id), { kind: "unavailable" }),
  comments: (id) => guard(() => listComments(id), { kind: "unavailable" }),
  drafts: (id) => guard(() => draftCommentsPort.listDrafts(id), { kind: "unavailable" }),
};
