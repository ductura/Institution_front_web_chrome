// In-memory stand-in for the changes routes (WEB-1704), for tests only: the server's blocks in its
// own order, and a reviewed revision that moves to the current one when the work is marked reviewed.
import type { ChangeBlock, ChangesPort, ChangesSnapshot } from "./model";

export const FAKE_BLOCKS: readonly ChangeBlock[] = [
  { kind: "heading", level: 1, text: "Izmišljeni naslov", change: "unchanged" },
  { kind: "paragraph", text: "Izmišljena ponovljena rečenica.", change: "removed" },
  { kind: "paragraph", text: "Izmišljeni novi odlomak.", change: "added" },
  { kind: "bulletItem", text: "Izmišljena stavka.", change: "unchanged" },
];

export function fakeChangesPort(reviewedRevision: number | null = 3, currentRevision = 5, now = "2026-11-21T10:00:00.000Z"):
  ChangesPort & { readonly marks: number; readonly reads: number } {
  let reviewed = reviewedRevision;
  let marks = 0;
  let reads = 0;
  const snapshot = (): ChangesSnapshot => reviewed === currentRevision
    ? { reviewedRevision: reviewed, currentRevision, changed: false, blocks: FAKE_BLOCKS.filter((b) => b.change !== "removed").map((b) => ({ ...b, change: "unchanged" })) }
    : { reviewedRevision: reviewed, currentRevision, changed: true, blocks: FAKE_BLOCKS };
  return {
    get marks() { return marks; },
    get reads() { return reads; },
    async read() {
      reads += 1;
      return { kind: "ready", snapshot: snapshot() };
    },
    async markReviewed() {
      marks += 1;
      reviewed = currentRevision;
      return { kind: "marked", reviewedRevision: currentRevision, reviewedAt: now };
    },
  };
}
