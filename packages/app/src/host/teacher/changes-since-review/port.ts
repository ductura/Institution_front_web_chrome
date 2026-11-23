// The real port of "changes since the last review" (WEB-1704): the generated client of src/client
// (createApi over the contract extract). It reads always; it marks reviewed only when the contract
// has the review route, otherwise markReviewed is absent and the card hides the action.
import { createApi, RESPONSES } from "../../../../../../src/client/api.ts";

import type { ChangesPort, ChangesRead, ReviewMark } from "./model";

type Call = ReturnType<typeof createApi>;

const READ_ROUTE = "work.changes-since-review.get";
const REVIEW_ROUTE = "work.review.post";

export async function readChanges(documentId: string, call: Call = createApi()): Promise<ChangesRead> {
  try {
    const answer = await call(READ_ROUTE, { params: { documentId }, query: undefined, body: undefined });
    if (answer.ok) return { kind: "ready", snapshot: answer.body };
    return { kind: answer.status === 401 ? "signedOut" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function markChangesReviewed(documentId: string, call: Call = createApi()): Promise<ReviewMark> {
  try {
    const answer = await call(REVIEW_ROUTE, { params: { documentId }, query: undefined, body: undefined });
    if (answer.ok) return { kind: "marked", reviewedRevision: answer.body.reviewedRevision, reviewedAt: answer.body.reviewedAt };
    if (answer.status === 401) return { kind: "signedOut" };
    // A refused request (4xx) was not recorded; a 5xx or no answer leaves it unknown.
    return answer.status >= 400 && answer.status < 500 ? { kind: "rejected" } : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

/** Builds the port; the review action exists only when the contract knows its route. */
export function changesPortFor(call: () => Call = () => createApi(), hasRoute: (id: string) => boolean = (id) => RESPONSES.has(id)): ChangesPort {
  const read = (documentId: string) => readChanges(documentId, call());
  if (!hasRoute(REVIEW_ROUTE)) return { read };
  return { read, markReviewed: (documentId) => markChangesReviewed(documentId, call()) };
}

export const changesPort: ChangesPort = changesPortFor();
