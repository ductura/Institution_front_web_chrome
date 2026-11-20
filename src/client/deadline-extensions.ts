/**
 * Deadline extensions for the teacher (WEB-1113; N-13, C-15).
 *
 * - GET /api/v1/teacher/assignments/{assignmentId}/deadline-extensions
 *   without a body answers 200 `{extensions}`.
 * - POST on the same path with `{scope, studentId?, dueAt, reasonId}` answers
 *   201 `{extension, existingSubmissionsUnchanged}`.
 *
 * The teacher types the new deadline as a minute of Europe/Zagreb; it is sent
 * as a UTC instant (`zagrebInstant`), never as the browser's local time. A
 * success is said only after the server's answer names what was sent (B-6).
 * `existingSubmissionsUnchanged: false` is never shown as a success.
 *
 * TODO(ugovor): the routes are not in the published contract yet. The shapes
 * are local (below), the caller passes the transport (`ExtensionCall`).
 */

import { zagrebInstant } from "../lib/i18n/zagreb.ts";
import { matchesSchema, type Schema } from "./schema-check.ts";
import type { Read } from "./submission.ts";

export type ExtensionRoute = "teacher.deadline-extensions.get" | "teacher.deadline-extensions.post";
export type Scope = "student" | "all";

/** Closed list of reasons (EXT_REASONS of the prototype); "for all" is a scope, not a reason. */
export const EXTENSION_REASONS = [
  { id: "justified", label: "Opravdan razlog" },
  { id: "technical", label: "Tehnička poteškoća" },
  { id: "agreed", label: "Dogovor s nastavnikom" },
] as const;
export type ReasonId = (typeof EXTENSION_REASONS)[number]["id"];

export type ExtensionInput = {
  readonly scope: Scope;
  readonly studentId?: string;
  readonly dueAt: string;
  readonly reasonId: ReasonId;
};

export type DeadlineExtension = {
  readonly extensionId: string;
  readonly scope: Scope;
  readonly studentId: string | null;
  readonly studentName: string | null;
  readonly previousDueAt: string;
  readonly dueAt: string;
  readonly reasonId: ReasonId;
  readonly recordedAt: string;
};

export type ExtensionCall = (
  id: ExtensionRoute,
  input: { readonly params: { readonly assignmentId: string }; readonly body?: ExtensionInput },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type CreateOutcome =
  | { readonly kind: "zabiljezeno"; readonly extension: DeadlineExtension; readonly existingSubmissionsUnchanged: boolean }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the extension may be recorded. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const INSTANT = { type: "string", format: "date-time" } as const;
const TEXT = { type: "string", minLength: 1, maxLength: 256 } as const;
const OR_NULL = (schema: Schema): Schema => ({ anyOf: [{ type: "null" }, schema] });
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const REASON: Schema = { anyOf: EXTENSION_REASONS.map((r) => ({ const: r.id })) };
const SCOPE: Schema = { anyOf: [{ const: "student" }, { const: "all" }] };

// TODO(ugovor): local shapes until the contract has these routes.
const EXTENSION: Schema = closed({
  extensionId: UUID,
  scope: SCOPE,
  studentId: OR_NULL(UUID),
  studentName: OR_NULL(TEXT),
  previousDueAt: INSTANT,
  dueAt: INSTANT,
  reasonId: REASON,
  recordedAt: INSTANT,
});
const LIST: Schema = closed({ extensions: { type: "array", items: EXTENSION } });
const CREATED: Schema = closed({ extension: EXTENSION, existingSubmissionsUnchanged: { type: "boolean" } });

const consistent = (e: DeadlineExtension) => (e.scope === "student") === (e.studentId !== null);

/** GET deadline-extensions. An answer outside the closed shape is `nepoznato`, never "none". */
export async function readDeadlineExtensions(
  call: ExtensionCall, assignmentId: string,
): Promise<Read<{ kind: "ready"; extensions: DeadlineExtension[] }>> {
  if (!matchesSchema(UUID, assignmentId)) return UNKNOWN;
  try {
    const result = await call("teacher.deadline-extensions.get", { params: { assignmentId } });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return UNKNOWN;
    const { extensions } = result.body as { extensions: DeadlineExtension[] };
    const ids = new Set(extensions.map((e) => e.extensionId));
    return ids.size === extensions.length && extensions.every(consistent) ? { kind: "ready", extensions } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** The form as typed. */
export type ExtensionForm = {
  readonly scope: Scope;
  readonly studentId: string;
  /** A `datetime-local` value: a minute of Europe/Zagreb. */
  readonly dueLocal: string;
  readonly reasonId: string;
};

export type FormProblem = "student" | "due" | "reason";

/**
 * The body to send, or the first problem. The student goes only with scope
 * `student` (a leftover choice is dropped with `all`); the deadline goes as the
 * UTC instant of the Zagreb minute.
 */
export function extensionInput(form: ExtensionForm): { ok: true; input: ExtensionInput } | { ok: false; problem: FormProblem } {
  if (form.scope === "student" && !matchesSchema(UUID, form.studentId)) return { ok: false, problem: "student" };
  const dueAt = zagrebInstant(form.dueLocal);
  if (dueAt === null) return { ok: false, problem: "due" };
  const reason = EXTENSION_REASONS.find((r) => r.id === form.reasonId);
  if (reason === undefined) return { ok: false, problem: "reason" };
  return {
    ok: true,
    input: form.scope === "student"
      ? { scope: "student", studentId: form.studentId, dueAt, reasonId: reason.id }
      : { scope: "all", dueAt, reasonId: reason.id },
  };
}

/** POST deadline-extensions. Never throws. */
export async function createDeadlineExtension(
  call: ExtensionCall, assignmentId: string, input: ExtensionInput,
): Promise<CreateOutcome> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("teacher.deadline-extensions.post", { params: { assignmentId }, body: input });
    if (result.ok) {
      if (result.status !== 201 || !matchesSchema(CREATED, result.body)) return UNKNOWN;
      const { extension, existingSubmissionsUnchanged } = result.body as { extension: DeadlineExtension; existingSubmissionsUnchanged: boolean };
      const same = extension.scope === input.scope && extension.reasonId === input.reasonId
        && (input.scope === "all" ? extension.studentId === null : extension.studentId === input.studentId)
        && Date.parse(extension.dueAt) === Date.parse(input.dueAt);
      return same && consistent(extension) ? { kind: "zabiljezeno", extension, existingSubmissionsUnchanged } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

const PATH = (assignmentId: string) => `/api/v1/teacher/assignments/${encodeURIComponent(assignmentId)}/deadline-extensions`;

/** The transport over fetch: same origin in the browser, the institution server (and the cookie) on the server. */
export function fetchExtensionCall(fetchImpl: typeof fetch, baseUrl = ""): ExtensionCall {
  return async (id, input) => {
    const get = id === "teacher.deadline-extensions.get";
    const response = await fetchImpl(`${baseUrl}${PATH(input.params.assignmentId)}`, {
      method: get ? "GET" : "POST",
      credentials: "same-origin",
      ...(get ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(input.body) }),
    });
    if (response.ok) {
      return { ok: true, status: response.status, body: await response.json().catch(() => null) } as const;
    }
    const failed = await response.json().catch(() => null) as { code?: unknown } | null;
    return { ok: false, status: response.status, code: typeof failed?.code === "string" ? failed.code : "error" } as const;
  };
}
