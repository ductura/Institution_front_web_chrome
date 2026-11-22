import { createApi, type ApiResult } from "@/client/api";

// WEB-1520: the calls of the "Etape" card. Server operation names (work.milestone-states.*, work.milestones.*).
type States = Extract<ApiResult<"work.milestone-states.get">, { ok: true }>["body"]["milestones"];
export type Stage = States[number];

export async function readStages(documentId: string, api = createApi()) {
  return api("work.milestone-states.get", { params: { documentId }, query: undefined, body: undefined });
}

export async function approveStage(documentId: string, milestoneId: string, message: string | undefined, api = createApi()) {
  return api("work.milestones.approve.post", { params: { documentId, milestoneId }, query: undefined, body: message === undefined ? {} : { message } });
}

export async function requestStageRevision(documentId: string, milestoneId: string, comment: string, revisionDueAt: string, api = createApi()) {
  return api("work.milestones.request-revision.post", { params: { documentId, milestoneId }, query: undefined, body: { comment, revisionDueAt } });
}

export async function renameStage(documentId: string, milestoneId: string, body: { title?: string; dueAt?: string }, api = createApi()) {
  return api("work.milestones.details.patch", { params: { documentId, milestoneId }, query: undefined, body });
}

export async function deleteStage(documentId: string, milestoneId: string, api = createApi()) {
  return api("work.milestones.delete", { params: { documentId, milestoneId }, query: undefined, body: undefined });
}
