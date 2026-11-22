import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const OPERATION = "ops.pilot-metrics.get";
export type PilotMetricsData = Extract<ApiResult<typeof OPERATION>, { ok: true }>["body"];

type PilotMetricsRead =
  | { kind: "ready"; data: PilotMetricsData }
  | { kind: "denied" | "unavailable" };

export type PilotMetricsState = PilotMetricsRead | { kind: "loading" };

export async function readPilotMetrics(options?: ApiOptions): Promise<PilotMetricsRead> {
  try {
    const answer = await createApi(options)(OPERATION, { params: undefined, query: {}, body: undefined });
    if (answer.ok) return { kind: "ready", data: answer.body };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
