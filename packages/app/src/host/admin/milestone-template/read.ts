import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

import { milestonesOf, type Draft, type TemplateVersion } from "./model";

const READ = "institution.milestone-template.get";
const WRITE = "institution.milestone-template.put";

type ReadBody = Extract<ApiResult<typeof READ>, { ok: true }>["body"];

export type TemplateRead =
  | { kind: "ready"; current: TemplateVersion | null; versions: readonly TemplateVersion[] }
  | { kind: "signedOut" | "denied" | "unavailable" };

export const asRead = (body: ReadBody): TemplateRead => ({ kind: "ready", current: body.current, versions: body.versions });

export async function readTemplate(options?: ApiOptions): Promise<TemplateRead> {
  try {
    const answer = await createApi(options)(READ, { params: undefined, query: {}, body: undefined });
    if (answer.ok) return asRead(answer.body);
    if (answer.status === 401) return { kind: "signedOut" };
    if (answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export type SaveResult =
  | { kind: "saved"; version: number }
  | { kind: "stale" | "invalid" | "signedOut" | "denied" | "unavailable" };

/** Saves a new version based on the one the administrator saw (`expectedVersion`; 0 when none was saved yet). */
export async function saveTemplate(expectedVersion: number, draft: Draft, options?: ApiOptions): Promise<SaveResult> {
  try {
    const answer = await createApi(options)(WRITE, {
      params: undefined, query: undefined,
      body: { expectedVersion, requireFinalStageApproval: draft.requireFinalStageApproval, milestones: milestonesOf(draft) },
    });
    if (answer.ok) return { kind: "saved", version: answer.body.version };
    if (answer.status === 409) return { kind: "stale" };
    if (answer.status === 422) return { kind: "invalid" };
    if (answer.status === 401) return { kind: "signedOut" };
    if (answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
