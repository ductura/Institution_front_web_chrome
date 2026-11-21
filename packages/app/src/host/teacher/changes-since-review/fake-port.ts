// In-memory stand-in for the changes route (WEB-1704): changes with times, and a review time that
// moves to "now" when the work is marked reviewed.
import type { ChangesPort, WorkChange } from "./model";

export const FAKE_CHANGES: readonly WorkChange[] = [
  { id: "c1", at: "2026-11-18T09:00:00.000Z", author: "student", kind: "added", text: "Izmišljeni uvodni odlomak." },
  { id: "c2", at: "2026-11-20T09:00:00.000Z", author: "student", kind: "edited", text: "Izmišljeni drugi odlomak." },
  { id: "c3", at: "2026-11-21T08:00:00.000Z", author: "teacher", kind: "removed", text: "Izmišljena ponovljena rečenica." },
];

export function fakeChangesPort(reviewedAt: string | null = "2026-11-19T12:00:00.000Z", now = "2026-11-21T10:00:00.000Z"):
  ChangesPort & { readonly marks: number } {
  let reviewed = reviewedAt;
  let marks = 0;
  return {
    get marks() { return marks; },
    async read() {
      return { kind: "ready", reviewedAt: reviewed, changes: FAKE_CHANGES };
    },
    async markReviewed() {
      marks += 1;
      reviewed = now;
      return { kind: "marked", reviewedAt: now };
    },
  };
}
