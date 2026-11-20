/** Pure rules of the find bar (prototype #find, INVENTAR 1.4); the page owns the document and the hits. */

export type FindKeyAction = "next" | "prev" | "close";

/** Enter goes to the next hit, Shift+Enter to the previous one, Escape closes. */
export function findKeyAction(key: string, shift: boolean): FindKeyAction | null {
  if (key === "Escape") return "close";
  if (key === "Enter") return shift ? "prev" : "next";
  return null;
}

/** The hit after a step; wraps round at both ends. Without hits there is no index (-1). */
export function stepHit(current: number, total: number, direction: 1 | -1): number {
  if (total <= 0) return -1;
  return (((current + direction) % total) + total) % total;
}

export type FindStatus = { kind: "idle" } | { kind: "none" } | { kind: "hit"; position: number; total: number };

/** Nothing typed: no message. Typed without hits: "none". Otherwise "n of N" (1-based, kept inside 1..N). */
export function findStatus(query: string, current: number, total: number): FindStatus {
  if (query === "") return { kind: "idle" };
  if (total <= 0) return { kind: "none" };
  return { kind: "hit", position: Math.min(Math.max(current, 0) + 1, total), total };
}
