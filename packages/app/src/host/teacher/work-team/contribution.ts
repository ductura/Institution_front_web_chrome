// WEB-V19-GRUPA: the teacher's read of what the server recorded for one team (teacher.work-team-contribution.get).
import type { createApi } from "@/client/api";
import { attempt, isNotFound, isSignedOut, type ContributionRead } from "../../student/work-team/read";

type Api = ReturnType<typeof createApi>;

export async function readContribution(call: Api, assignmentId: string, teamId: string): Promise<ContributionRead> {
  const r = await attempt(() => call("teacher.work-team-contribution.get", { params: { assignmentId, teamId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (r.ok) return { kind: "ok", view: r.body };
  if (isSignedOut(r)) return { kind: "signedOut" };
  return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
}
