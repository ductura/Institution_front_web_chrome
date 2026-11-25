// ED-15 (NF2-P8, P2-10b): the proofs the mentor asked the student for, at the top of the Izvori card
// (prototype nf2.js reqBlock). Read from student.source-proof-requests.get; the mentor's working notes
// never reach the student. Recommended sources have no student route yet and are not shown here.
import { createApi } from "../../../../../../src/client/api.ts";

export type ProofRequest = {
  readonly id: string;
  readonly sourceId: string;
  readonly instruction: string;
  readonly dueAt: string;
  readonly closedAt: string | null;
};

export type RequestsRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly requests: readonly ProofRequest[] };

type RequestsCall = (
  id: "student.source-proof-requests.get",
  input: { readonly params: { readonly assignmentId: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: boolean; status: number; body?: unknown }>;

const isRequest = (r: unknown): r is ProofRequest => {
  if (typeof r !== "object" || r === null) return false;
  const v = r as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.sourceId === "string" && typeof v.instruction === "string"
    && typeof v.dueAt === "string" && (v.closedAt === null || typeof v.closedAt === "string");
};

/** The mentor's requests through the shared client; anything but the contract's answer is "unavailable". */
export async function readRequests(call: RequestsCall, assignmentId: string): Promise<RequestsRead> {
  try {
    const answer = await call("student.source-proof-requests.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!answer.ok || answer.status !== 200) return { kind: "unavailable" };
    const list = (answer.body as { proofRequests?: unknown } | undefined)?.proofRequests;
    if (!Array.isArray(list) || !list.every(isRequest)) return { kind: "unavailable" };
    return { kind: "ready", requests: list.map(({ id, sourceId, instruction, dueAt, closedAt }) => ({ id, sourceId, instruction, dueAt, closedAt })) };
  } catch {
    return { kind: "unavailable" };
  }
}

export const liveRequests = (assignmentId: string) => readRequests(createApi() as unknown as RequestsCall, assignmentId);

/** "28. 11. 2026." in the student's own time zone; "" for a date the server did not send as a date. */
export function dayOf(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`;
}

export type RequestRow = {
  readonly id: string;
  /** The source as the work names it, or null when the source is no longer in the work. */
  readonly label: string | null;
  readonly instruction: string;
  readonly due: string;
  readonly overdue: boolean;
};

/** Open requests, the earliest deadline first, each named by its source in the work. */
export function openRows(requests: readonly ProofRequest[], sources: readonly { id: string; label: string }[], now: number): RequestRow[] {
  const names = new Map(sources.map((s) => [s.id, s.label]));
  return requests
    .filter((r) => r.closedAt === null)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .map((r) => ({
      id: r.id,
      label: names.get(r.sourceId) ?? null,
      instruction: r.instruction.trim(),
      due: dayOf(r.dueAt),
      overdue: Date.parse(r.dueAt) < now,
    }));
}
