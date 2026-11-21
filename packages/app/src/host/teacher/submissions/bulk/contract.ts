// Bulk download of the submissions of one assignment (WEB-1902; plan P-D2). TODO(ugovor): the routes
// are not in @ductura/contracts yet; the caller passes the transport and createApi answers
// "client_rejected", so the screen says "unavailable", never "no submissions". Assumption (PR): the
// status route answers one closed object; the file link is a path on this origin that the server
// names, and the screen only renders it as a link.
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type BulkCall = (
  id: "teacher.submissions-bulk.get" | "teacher.submissions-bulk.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type BulkStatus =
  | { readonly state: "empty" }
  | { readonly state: "idle"; readonly submissionCount: number }
  | { readonly state: "preparing"; readonly submissionCount: number }
  | { readonly state: "ready"; readonly submissionCount: number; readonly href: string; readonly expiresAt: string };

export type BulkRead =
  | { readonly kind: "ready"; readonly status: BulkStatus }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "forbidden" }
  | { readonly kind: "nepoznato" };

export type BulkRequest =
  | { readonly kind: "zaprimljeno"; readonly status: BulkStatus }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "forbidden" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID: Schema = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
const COUNT: Schema = { type: "integer", minimum: 0 };
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const STATUS: Schema = {
  anyOf: [
    closed({ state: { const: "empty" } }),
    closed({ state: { const: "idle" }, submissionCount: COUNT }),
    closed({ state: { const: "preparing" }, submissionCount: COUNT }),
    closed({ state: { const: "ready" }, submissionCount: COUNT, href: { type: "string" }, expiresAt: { type: "string", format: "date-time" } }),
  ],
};

/** A link the screen may render: a path on this origin, never another host or a script. */
export const isSafeHref = (href: string): boolean => /^\/[^/\\\s]/.test(href) && !/[\u0000-\u001f]/.test(href);

function parse(body: unknown): BulkStatus | null {
  if (!matchesSchema(STATUS, body)) return null;
  const status = body as BulkStatus;
  if (status.state === "ready" && !isSafeHref(status.href)) return null;
  if (status.state === "idle" && status.submissionCount === 0) return null;
  return status;
}

export async function readBulkStatus(call: BulkCall, assignmentId: string): Promise<BulkRead> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.submissions-bulk.get", { params: { assignmentId } });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      if (result.status === 403) return { kind: "greska", code: "forbidden" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    const status = result.status === 200 ? parse(result.body) : null;
    return status === null ? UNKNOWN : { kind: "ready", status };
  } catch {
    return UNKNOWN;
  }
}

/** Asks the server to prepare the file. Success only from an answer that says it was taken up. */
export async function requestBulkPreparation(call: BulkCall, assignmentId: string): Promise<BulkRequest> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.submissions-bulk.post", { body: { assignmentId } });
    if (result.ok) {
      const status = result.status === 200 || result.status === 202 ? parse(result.body) : null;
      return status !== null && (status.state === "preparing" || status.state === "ready") ? { kind: "zaprimljeno", status } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 403) return { kind: "greska", code: "forbidden" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
