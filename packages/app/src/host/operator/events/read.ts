import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const OPERATION = "ops.events.get";
export type EventsData = Extract<ApiResult<typeof OPERATION>, { ok: true }>["body"];
export type SystemEvent = EventsData["events"][number];
export type EventsPage = { events: readonly SystemEvent[]; next: number | null };

type EventsRead = { kind: "ready"; data: EventsPage } | { kind: "denied" | "unavailable" };
export type EventsState = EventsRead | { kind: "loading" };

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** The contract wants an ISO instant with the trailing Z, milliseconds at most three digits. */
export const instant = (date: Date) => date.toISOString();

/**
 * F4-PM2-R16: one page of ops.events.get for the last 24 hours (`now` is injected for the test), or the page
 * after `after`. 401/403 is "denied" and shows no event; anything else is "unavailable".
 */
export async function readEvents(options?: ApiOptions & { now?: Date; after?: number }): Promise<EventsRead> {
  const now = options?.now ?? new Date();
  const query = {
    from: instant(new Date(now.getTime() - WINDOW_MS)),
    to: instant(now),
    ...(options?.after === undefined ? {} : { after: String(options.after) }),
  };
  try {
    const answer = await createApi(options)(OPERATION, { params: undefined, query, body: undefined });
    if (answer.ok) return { kind: "ready", data: { events: answer.body.events, next: answer.body.next } };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
