// WEB-V16-POVJERENSTVO: the reads (work.thesis-committee.get, institution.teacher-roles.get), parsed by hand from the
// server's answer: a wrong shape is "unavailable", never an empty list; 404 is the work the server does not show.
import type { createApi } from "@/client/api";

import type { SectionRead } from "../model";

export type Call = ReturnType<typeof createApi>;
export type CommitteeRole = "chair" | "member";
export type PersonName = { readonly givenName: string; readonly familyName: string };
export type CommitteeMember = { readonly userId: string; readonly name: PersonName | null; readonly role: CommitteeRole };
export type CommitteeValue = { readonly members: readonly CommitteeMember[]; readonly changedAt: string | null; readonly changedByPart: "faculty" | null };
export type Candidate = { readonly personId: string; readonly name: PersonName | null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseName(v: unknown): PersonName | null | undefined {
  if (v === null) return null;
  return isObj(v) && typeof v.givenName === "string" && typeof v.familyName === "string" ? { givenName: v.givenName, familyName: v.familyName } : undefined;
}

export function parseCommittee(v: unknown): CommitteeValue | null {
  if (!isObj(v) || !Array.isArray(v.members) || v.members.length > 5) return null;
  const changedAt = v.changedAt === null || typeof v.changedAt === "string" ? v.changedAt : undefined;
  const part = v.changedByPart === null || v.changedByPart === "faculty" ? v.changedByPart : undefined;
  if (changedAt === undefined || part === undefined) return null;
  const members: CommitteeMember[] = [];
  for (const m of v.members) {
    if (!isObj(m) || typeof m.userId !== "string" || (m.role !== "chair" && m.role !== "member")) return null;
    const name = parseName(m.name);
    if (name === undefined) return null;
    members.push({ userId: m.userId, name, role: m.role });
  }
  return { members, changedAt, changedByPart: part };
}

type Answer = { ok: true; body: unknown } | { ok: false; status: number };

export async function readCommittee(call: Call, documentId: string): Promise<SectionRead<CommitteeValue>> {
  let a: Answer;
  try { a = (await call("work.thesis-committee.get", { params: { documentId }, query: undefined, body: undefined })) as Answer; } catch { return { kind: "unavailable" }; }
  if (!a.ok) return a.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
  const value = parseCommittee(a.body);
  return value === null ? { kind: "unavailable" } : { kind: "ready", value };
}

/** The confirmed teachers of the institution (administrator only); anything else is "unavailable", not an empty list. */
export async function readCandidates(call: Call): Promise<readonly Candidate[] | null> {
  let a: Answer;
  try { a = (await call("institution.teacher-roles.get", { params: undefined, query: {}, body: undefined })) as Answer; } catch { return null; }
  if (!a.ok || !isObj(a.body) || !Array.isArray(a.body.confirmed)) return null;
  const out: Candidate[] = [];
  for (const c of a.body.confirmed) {
    if (!isObj(c) || typeof c.personId !== "string") return null;
    const name = parseName(c.name);
    if (name === undefined) return null;
    out.push({ personId: c.personId, name });
  }
  return out;
}
