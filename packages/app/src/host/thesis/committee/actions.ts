// WEB-V16-POVJERENSTVO: the pure rules of the committee list and its write. The limits are checked before any
// request (the server stays the authority and answers 403/404/422); the result comes only from the answer.
import type { Call, CommitteeMember, CommitteeRole } from "./read";
import { parseCommittee } from "./read";

export const MAX_MEMBERS = 5;
export type Problem = "tooMany" | "manyChairs" | "duplicate";
export type CommitteeOutcome =
  | { readonly kind: "saved"; readonly members: readonly CommitteeMember[] }
  | { readonly kind: "unchanged" | "invalid" | "forbidden" | "notFound" | "signedOut" | "unknown" };

export type Draft = { readonly userId: string; readonly role: CommitteeRole };

/** The first rule a list breaks, or null: at most 5 members, at most one chair, nobody twice. */
export function checkCommittee(members: readonly Draft[]): Problem | null {
  if (members.length > MAX_MEMBERS) return "tooMany";
  if (members.filter((m) => m.role === "chair").length > 1) return "manyChairs";
  if (new Set(members.map((m) => m.userId)).size !== members.length) return "duplicate";
  return null;
}

const key = (members: readonly Draft[]) => JSON.stringify([...members].map((m) => [m.userId, m.role]).sort());

/** Replaces the whole list. A list that breaks a rule, or equals the one in force, sends nothing. */
export async function writeCommittee(call: Call, documentId: string, current: readonly Draft[], next: readonly Draft[]): Promise<CommitteeOutcome | { readonly kind: "problem"; readonly problem: Problem }> {
  const problem = checkCommittee(next);
  if (problem !== null) return { kind: "problem", problem };
  if (key(current) === key(next)) return { kind: "unchanged" };
  const members = next.map((m) => ({ userId: m.userId, role: m.role }));
  let r: { ok: boolean; status?: number; body?: unknown };
  try { r = (await call("work.thesis-committee.put", { params: { documentId }, query: undefined, body: { members } })) as typeof r; } catch { return { kind: "unknown" }; }
  if (r.ok) {
    const parsed = parseCommittee(r.body);
    return parsed === null ? { kind: "unknown" } : { kind: "saved", members: parsed.members };
  }
  switch (r.status) {
    case 401: return { kind: "signedOut" };
    case 403: return { kind: "forbidden" };
    case 404: return { kind: "notFound" };
    case 422: return { kind: "invalid" };
    default: return { kind: "unknown" };
  }
}
