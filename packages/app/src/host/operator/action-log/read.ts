import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const OPERATION = "institution.admin-actions.get";
export type ActionLogData = Extract<ApiResult<typeof OPERATION>, { ok: true }>["body"];
export type ActionLogEntry = ActionLogData["entries"][number];

type ActionLogRead = { kind: "ready"; data: ActionLogData } | { kind: "denied" | "unavailable" };
export type ActionLogState = ActionLogRead | { kind: "loading" };

/** NF-7 OA-3: one read of institution.admin-actions.get through the shared client; 401/403 is "denied", anything else "unavailable". */
export async function readActionLog(options?: ApiOptions): Promise<ActionLogRead> {
  try {
    const answer = await createApi(options)(OPERATION, { params: undefined, query: {}, body: undefined });
    if (answer.ok) return { kind: "ready", data: answer.body };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
