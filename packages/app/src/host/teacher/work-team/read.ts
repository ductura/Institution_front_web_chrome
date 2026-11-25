// WEB-V19-GRUPA: the teacher's reads and writes of the teams of one assignment, through the contract only
// (institution.assignment-team-setting.*, teacher.work-teams.*, teacher.work-team-member.post,
// teacher.work-team-contribution.get). A refusal is never an empty answer: "not found" (another course's,
// unknown and malformed ids read the same), "signed out" and "unavailable" are states of their own, and a
// write whose answer was lost is "unknown", never "saved".
import type { createApi, Input } from "@/client/api";
import { attempt, isNotFound, isSignedOut, type ContributionRead, type Formation } from "../../student/work-team/read";

export { readContribution as readTeamContribution } from "./contribution";
export type { ContributionRead, Formation } from "../../student/work-team/read";

type Api = ReturnType<typeof createApi>;

export type Setting = { readonly enabled: boolean; readonly minSize: number; readonly maxSize: number; readonly formation: Formation };
export type Person = { readonly studentId: string; readonly givenName: string; readonly familyName: string };
export type Member = Person & { readonly workState: "not_started" | "in_progress" | "submitted" };
export type TeamsView = { readonly teams: readonly { readonly teamId: string; readonly members: readonly Member[] }[]; readonly unassigned: readonly Person[] };

export type Read<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type Write<T = undefined> =
  | { readonly kind: "done"; readonly value: T }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  | { readonly kind: "unknown" };

function failedRead(r: { readonly status: number; readonly code: string }): { kind: "signedOut" | "notFound" | "unavailable" } {
  if (isSignedOut(r)) return { kind: "signedOut" };
  return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
}
function failedWrite(r: { readonly status: number; readonly code: string }): { kind: "signedOut" | "notFound" | "conflict" | "invalid" | "unknown" } {
  if (isSignedOut(r)) return { kind: "signedOut" };
  if (isNotFound(r)) return { kind: "notFound" };
  if (r.code === "conflict") return { kind: "conflict" };
  if (r.code === "invalid_input" || r.code === "invalid_json" || r.code === "client_rejected") return { kind: "invalid" };
  return { kind: "unknown" };
}

export async function readSetting(call: Api, assignmentId: string): Promise<Read<Setting>> {
  const r = await attempt(() => call("institution.assignment-team-setting.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", value: r.body } : failedRead(r);
}

export async function putSetting(call: Api, assignmentId: string, body: Setting): Promise<Write<Setting>> {
  const r = await attempt(() => call("institution.assignment-team-setting.put", { params: { assignmentId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "done", value: r.body } : failedWrite(r);
}

export async function readTeams(call: Api, assignmentId: string): Promise<Read<TeamsView>> {
  const r = await attempt(() => call("teacher.work-teams.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", value: r.body } : failedRead(r);
}

export async function createTeam(call: Api, assignmentId: string): Promise<Write<{ readonly teamId: string }>> {
  const r = await attempt(() => call("teacher.work-teams.post", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "done", value: { teamId: r.body.teamId } } : failedWrite(r);
}

export type MemberAction = Input<"teacher.work-team-member.post">["body"];

export async function memberAction(call: Api, assignmentId: string, teamId: string, body: MemberAction): Promise<Write> {
  const r = await attempt(() => call("teacher.work-team-member.post", { params: { assignmentId, teamId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  return r.ok ? { kind: "done", value: undefined } : failedWrite(r);
}
