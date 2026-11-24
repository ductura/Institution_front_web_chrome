// NF-3 PR-16 (E-7b, PO-40): the teacher's request for revision of this work, from
// notifications.returned-for-revision.list.get of the contract excerpt, checked against the
// contract's answer schema. The notification's `targetId` is the assignment, as the shell's
// notifications read it (`/rad/{targetId}`). Only the first page is read (up to 50, newest first);
// a rejected call reads as "unknown", and the steps then show no revision block at all.
import migrationContracts from "../../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type RevisionCall = (
  id: "notifications.returned-for-revision.list.get",
  input: { readonly params?: undefined; readonly query?: Readonly<Record<string, string>>; readonly body?: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type RevisionRequest = {
  readonly id: string;
  /** The teacher's comment, up to 2000 characters. */
  readonly comment: string;
  /** The deadline of the revision (obligatory by decision 2151; the contract still allows null). */
  readonly dueAt: string | null;
  readonly createdAt: string;
};

export type RevisionRead =
  | { readonly kind: "ready"; readonly request: RevisionRequest | null }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const PAGE = migrationContracts["notifications.returned-for-revision.list.get"].responses["200"].content["application/json"].schema as Schema;

type Raw = { id: string; targetId: string; comment: string; revisionDueAt: string | null; createdAt: string };

export async function readRevisionRequest(call: RevisionCall, assignmentId: string): Promise<RevisionRead> {
  try {
    const result = await call("notifications.returned-for-revision.list.get", { params: undefined, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(PAGE, result.body)) return UNKNOWN;
    const mine = (result.body as { notifications: Raw[] }).notifications
      .filter((n) => n.targetId.toLowerCase() === assignmentId.toLowerCase())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const newest = mine[0];
    return {
      kind: "ready",
      request: newest === undefined ? null : { id: newest.id, comment: newest.comment, dueAt: newest.revisionDueAt, createdAt: newest.createdAt },
    };
  } catch {
    return UNKNOWN;
  }
}
