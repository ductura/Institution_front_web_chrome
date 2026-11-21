// Pure rules of "changes since the last review" (WEB-1704; plan M6.7, N-05). The teacher opens
// the changes made to a work after the time of the last review and marks the work reviewed. The
// list is shown as the server gives it, oldest first; this module never invents or drops a change.
// No server route exists yet: ChangesPort is the smallest contract the plan implies. No network
// call is made here; the page that mounts this passes the real port.
import { changesMessages as text } from "./messages.hr";

export type ChangeKind = "added" | "removed" | "edited";

export type WorkChange = {
  readonly id: string;
  readonly at: string;
  readonly author: "student" | "teacher";
  readonly kind: ChangeKind;
  readonly text: string;
};

export type ChangesRead =
  | { readonly kind: "ready"; readonly reviewedAt: string | null; readonly changes: readonly WorkChange[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type ReviewMark =
  | { readonly kind: "marked"; readonly reviewedAt: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

export interface ChangesPort {
  read(assignmentId: string): Promise<ChangesRead>;
  markReviewed(assignmentId: string): Promise<ReviewMark>;
}

/** Changes strictly after the last review, in time order; all of them when there was no review. */
export function changesSince(reviewedAt: string | null, changes: readonly WorkChange[]): readonly WorkChange[] {
  const limit = reviewedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(reviewedAt);
  return changes
    .filter((change) => Date.parse(change.at) > limit)
    .toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function kindLabel(kind: ChangeKind): string {
  return kind === "added" ? text.added : kind === "removed" ? text.removed : text.edited;
}

export function authorLabel(author: WorkChange["author"]): string {
  return author === "teacher" ? text.byTeacher : text.byStudent;
}

/** Marks the work reviewed; the answer counts only when it carries a valid time. */
export async function markWorkReviewed(port: ChangesPort, assignmentId: string): Promise<ReviewMark> {
  let result: ReviewMark;
  try {
    result = await port.markReviewed(assignmentId);
  } catch {
    return { kind: "unknown" };
  }
  if (result.kind === "marked" && Number.isNaN(Date.parse(result.reviewedAt))) return { kind: "unknown" };
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
