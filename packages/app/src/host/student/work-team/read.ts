// WEB-V19-GRUPA: the reads and the one write of the student's team, and the contribution of the team,
// through the contract only (student.work-team.get/post, student.work-team-contribution.get). A refusal is
// never an empty answer: "not found" (another course's or an unknown assignment reads the same), "signed
// out" and "unavailable" are states of their own.
import type { createApi, Input } from "@/client/api";

type Api = ReturnType<typeof createApi>;
export type Formation = "student_choice" | "teacher_assigned";
export type Category = "written" | "ai_transferred" | "pasted" | "imported" | "unattributed";

export type TeamView =
  | { readonly state: "disabled" }
  | { readonly state: "none"; readonly formation: Formation; readonly openTeams: readonly { readonly teamId: string; readonly memberCount: number }[] }
  | { readonly state: "member"; readonly team: { readonly teamId: string; readonly members: readonly { readonly givenName: string; readonly familyName: string }[] } };
export type TeamRead =
  | { readonly kind: "ok"; readonly view: TeamView }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

/** What the server said about the contribution. `ready` carries counts of code points, never a share, a rank or a mark. */
export type ContributionView =
  | { readonly state: "disabled" | "none" | "pending" | "failed" }
  | {
    readonly state: "ready";
    readonly members: readonly { readonly givenName: string; readonly familyName: string; readonly categories: readonly { readonly category: Category; readonly codePoints: number }[]; readonly totalCodePoints: number }[];
    readonly notice: "not_authorship_evidence";
  };
export type ContributionRead =
  | { readonly kind: "ok"; readonly view: ContributionView }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type TeamAction = Input<"student.work-team.post">["body"];
export type ActionOutcome =
  | { readonly kind: "done"; readonly view: TeamView }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the action may have been recorded. */
  | { readonly kind: "unknown" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
export const isSignedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
export const isNotFound = (r: { readonly status: number; readonly code: string }) => r.status === 404 || r.code === "not_found";

/** The client rejects when the connection drops or the body cannot be read: "unavailable" for a read, "unknown" for a write. */
export async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

function refusal(r: { readonly status: number; readonly code: string }): "signedOut" | "notFound" | "unavailable" {
  if (isSignedOut(r)) return "signedOut";
  return isNotFound(r) ? "notFound" : "unavailable";
}

export async function readTeam(call: Api, assignmentId: string): Promise<TeamRead> {
  const r = await attempt(() => call("student.work-team.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", view: r.body } : { kind: refusal(r) };
}

export async function readContribution(call: Api, assignmentId: string): Promise<ContributionRead> {
  const r = await attempt(() => call("student.work-team-contribution.get", { params: { assignmentId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  return r.ok ? { kind: "ok", view: r.body } : { kind: refusal(r) };
}

export async function teamAction(call: Api, assignmentId: string, body: TeamAction): Promise<ActionOutcome> {
  const r = await attempt(() => call("student.work-team.post", { params: { assignmentId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "done", view: r.body };
  if (isSignedOut(r)) return { kind: "signedOut" };
  if (isNotFound(r)) return { kind: "notFound" };
  if (r.code === "conflict") return { kind: "conflict" };
  if (r.code === "invalid_input" || r.code === "invalid_json" || r.code === "client_rejected") return { kind: "invalid" };
  return { kind: "unknown" };
}
