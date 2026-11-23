// PIL-D3-NASTAVNIK: the real port of the teacher's history and withdrawal switch, over the contract
// client's transport (createApi, passed in by the page). No network primitive here.
import type { HistoryCall } from "./contract";

type Answer = Awaited<ReturnType<HistoryCall>>;
/** The transport as createApi takes it: every operation names its params, query and body. */
export type HistoryTransport = (
  id: Parameters<HistoryCall>[0],
  input: { readonly params: Readonly<Record<string, string>>; readonly query: undefined; readonly body: unknown },
) => Promise<Answer>;

/**
 * A refused read (403) reads as "not found", as on the submissions table: another teacher learns
 * nothing about the assignment. A refused save keeps its 403, so the switch can say who may change it.
 */
export function clientHistoryCall(call: HistoryTransport): HistoryCall {
  return async (id, input) => {
    const result = await call(id, { params: { ...input.params }, query: undefined, body: input.body });
    const read = id !== "teacher.submission-withdrawal.post";
    return read && !result.ok && result.status === 403 ? { ok: false, status: 404, code: "not_found" } : result;
  };
}
