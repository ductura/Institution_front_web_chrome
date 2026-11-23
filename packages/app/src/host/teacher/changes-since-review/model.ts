// Pure rules of "changes since the last review" (WEB-1704; plan M6.7, N-05). The teacher opens the
// changes made to a work since the revision last marked reviewed and may mark the current revision
// reviewed. The shapes follow the server contract (work.changes-since-review.get, work.review.post):
// the blocks are shown exactly as the server gives them, in its order; this module never invents,
// reorders or drops a block. No network call is made here; the page passes the real port (port.ts),
// tests pass the fake one (fake-port.ts).
import { changesMessages as text } from "./messages.hr";

export type BlockChange = "unchanged" | "removed" | "added";

export type ChangeBlock =
  | { readonly kind: "paragraph" | "bulletItem" | "quote"; readonly text: string; readonly change: BlockChange }
  | { readonly kind: "heading"; readonly level: number; readonly text: string; readonly change: BlockChange };

export type ChangesSnapshot = {
  readonly reviewedRevision: number | null;
  readonly currentRevision: number;
  readonly changed: boolean;
  readonly blocks: readonly ChangeBlock[];
};

export type ChangesRead =
  | { readonly kind: "ready"; readonly snapshot: ChangesSnapshot }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type ReviewMark =
  | { readonly kind: "marked"; readonly reviewedRevision: number; readonly reviewedAt: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

/** markReviewed is absent when the contract has no route for it; the card then hides the action. */
export interface ChangesPort {
  read(documentId: string): Promise<ChangesRead>;
  readonly markReviewed?: (documentId: string) => Promise<ReviewMark>;
}

export type ChangeItem = { readonly key: string; readonly label: string; readonly change: BlockChange; readonly text: string };

/** One item per block, in the server's order: nothing is filtered, sorted or added. */
export function changeItems(snapshot: ChangesSnapshot): readonly ChangeItem[] {
  return snapshot.blocks.map((block, index) => ({
    key: `${index}`,
    label: changeLabel(block.change),
    change: block.change,
    text: block.text,
  }));
}

export function changeLabel(change: BlockChange): string {
  return change === "added" ? text.added : change === "removed" ? text.removed : text.unchanged;
}

export function reviewLine(snapshot: ChangesSnapshot): string {
  const current = `${text.currentRevision} ${snapshot.currentRevision}`;
  return snapshot.reviewedRevision === null
    ? `${text.noReview} ${current}.`
    : `${text.since} ${snapshot.reviewedRevision}. ${current}.`;
}

const SERVER_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Marks the work reviewed. It counts as reviewed only when the server confirmed it with a valid
 * revision and time; a throwing port or a malformed answer is "unknown", never "marked".
 */
export async function markWorkReviewed(port: ChangesPort, documentId: string): Promise<ReviewMark> {
  if (port.markReviewed === undefined) return { kind: "rejected" };
  let result: ReviewMark;
  try {
    result = await port.markReviewed(documentId);
  } catch {
    return { kind: "unknown" };
  }
  if (result.kind === "marked" && (!Number.isSafeInteger(result.reviewedRevision) || result.reviewedRevision < 1
    || !SERVER_TIME.test(result.reviewedAt) || Number.isNaN(Date.parse(result.reviewedAt)))) {
    return { kind: "unknown" };
  }
  return result;
}

export function markMessage(result: ReviewMark): string {
  switch (result.kind) {
    case "marked": return text.marked;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}
