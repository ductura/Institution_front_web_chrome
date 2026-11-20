import { createApi, type ApiResult } from "./api";

type Milestones = Extract<ApiResult<"work.milestones.get">, { ok: true }>["body"]["milestones"];
export type WorkMilestone = Milestones[number];

export async function readWorkMilestones(documentId: string, api = createApi()) {
  return api("work.milestones.get", { params: { documentId }, query: undefined, body: undefined });
}

export async function saveWorkMilestoneDue(documentId: string, milestoneId: string, dueAt: string, api = createApi()) {
  const result = await api("work.milestones.patch", { params: { documentId, milestoneId }, query: undefined, body: { dueAt } });
  if (result.ok && result.body.id.toLowerCase() !== milestoneId.toLowerCase()) {
    return { ok: false, status: result.status, code: "unexpected" } as const;
  }
  return result;
}
