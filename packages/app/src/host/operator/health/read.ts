import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const HEALTH = "platform.health.get";
const READY = "platform.ready.get";
export type HealthData = Extract<ApiResult<typeof HEALTH>, { ok: true }>["body"];
export type ReadyData = Extract<ApiResult<typeof READY>, { ok: true }>["body"];

/** `ready` is null when the server answered 503 (not ready or draining): that is a state to show, not an error. */
export type SystemHealth = { health: HealthData; ready: ReadyData | null; notReady: "not_ready" | "draining" | null };
type HealthRead = { kind: "ready"; data: SystemHealth } | { kind: "unavailable" };
export type HealthState = HealthRead | { kind: "loading" };

/**
 * F4-PM2-R16: one read of the two public probes through the shared client. A failed or malformed health answer
 * is "unavailable" (never a green state from nothing); a 503 of /ready is shown as the server's own state.
 */
export async function readSystemHealth(options?: ApiOptions): Promise<HealthRead> {
  try {
    const call = createApi(options);
    const [health, ready] = await Promise.all([
      call(HEALTH, { params: undefined, query: undefined, body: undefined }),
      call(READY, { params: undefined, query: undefined, body: undefined }),
    ]);
    if (!health.ok) return { kind: "unavailable" };
    if (ready.ok) return { kind: "ready", data: { health: health.body, ready: ready.body, notReady: null } };
    if (ready.status === 503) {
      const draining = ready.code === "draining";
      return { kind: "ready", data: { health: health.body, ready: null, notReady: draining ? "draining" : "not_ready" } };
    }
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
