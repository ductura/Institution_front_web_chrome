import type { RevisionRequest } from "../../../../../../../src/client/revision-requests.ts";

/** What the review cards decide from the revision requests the server listed. */
export type RoundView =
  | { kind: "none" }
  /** Nothing waits on the student; the round number is the highest request. */
  | { kind: "student-turn"; round: number; open: number }
  /** The student sent a version; the teacher is to review it. */
  | { kind: "teacher-turn"; round: number; waiting: number };

const live = (request: RevisionRequest) => request.state !== "withdrawn";

/** Round N = the highest request number still alive; waiting = states that ask someone to act. */
export function roundOf(requests: readonly RevisionRequest[]): RoundView {
  const alive = requests.filter(live);
  if (alive.length === 0) return { kind: "none" };
  const round = Math.max(...alive.map((request) => request.number));
  const responded = alive.filter((request) => request.state === "responded").length;
  const open = alive.filter((request) => request.state === "open" || request.state === "reopened").length;
  if (responded > 0) return { kind: "teacher-turn", round, waiting: responded };
  return open > 0 ? { kind: "student-turn", round, open } : { kind: "none" };
}

/** The line of the notice "Runda N čeka Vaš pregled." — only for the teacher, only when a version waits. */
export function roundNotice(view: RoundView, role: "student" | "teacher", template: string): string | null {
  return role === "teacher" && view.kind === "teacher-turn" ? template.replace("{n}", String(view.round)) : null;
}

/** The single "Usporedi s …" menu offers sent versions only, newest first, never the current one. */
export function compareOptions(versions: readonly { kind: "submission" | "checkpoint"; revision: number }[]): number[] {
  return versions.filter((version) => version.kind === "submission").map((version) => version.revision)
    .sort((a, b) => b - a);
}

/** Port of the two actions the contract extract does not carry yet; `null` means unavailable. */
export type RevisionPort = {
  send: ((body: { action: "send"; documentId: string; message: string }) => Promise<number | null>) | null;
  returnForRevision: ((body: { action: "return"; documentId: string; instruction: string; dueAt: string | null }) => Promise<number | null>) | null;
};

/** Live port: send and return are not in the migration contract extract (WEB-2121 PITANJE), so they are unavailable. */
export const LIVE_PORT: RevisionPort = { send: null, returnForRevision: null };
