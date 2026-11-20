/**
 * Deadline extensions for the teacher (WEB-1113; N-13, C-15, B-6).
 *
 * teacher.deadline-extensions.get lists the extensions of an assignment;
 * teacher.deadline-extension.post records one for one student or for all.
 * The page turns the Zagreb minute the teacher typed into the UTC instant it
 * means (src/lib/i18n/zagreb.ts zagrebInstant) and hands that instant here. A record is `zabiljezeno` only after the server's
 * answer names the same scope, student and deadline (B-6): no success before
 * that. Routes of Institution_server SRV-1108 (API 1.35.0), reached through
 * the migration supplement of createApi (WEB-07) until the contracts are
 * published.
 */

import type { createApi } from "./api";
import type { Read } from "./submission";

type Api = ReturnType<typeof createApi>;

/** N-13 EXT_REASONS, in the order of the form; "all" only for all students. */
export const EXTENSION_REASONS = ["justified", "technical", "agreement", "all"] as const;
export type ExtensionReason = (typeof EXTENSION_REASONS)[number];

export type DeadlineExtension = {
  readonly id: string;
  readonly scope: "one" | "all";
  readonly studentId: string | null;
  readonly previousDueAt: string;
  readonly dueAt: string;
  /** Null on a record another teacher wrote: the reason stays the author's. */
  readonly reasonId: ExtensionReason | null;
  readonly createdBy: string;
  readonly createdAt: string;
};

export type ExtensionStudent = { readonly studentId: string; readonly name: string | null };

export type ExtensionDraft = {
  readonly scope: "one" | "all";
  readonly studentId: string;
  /** The UTC instant of the Zagreb minute typed (Date.toISOString), or null when it is none. */
  readonly dueAt: string | null;
  readonly reasonId: string;
};

export type RecordOutcome =
  | {
      readonly kind: "zabiljezeno";
      readonly extension: DeadlineExtension;
      /** A submission in the scope was already recorded; the extension leaves it as it is. */
      readonly existingSubmissionsUnchanged: boolean;
    }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the extension may be recorded. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function failure(status: number, code: string): Exclude<RecordOutcome, { kind: "zabiljezeno" }> {
  if (status === 401) return { kind: "session-expired" };
  if (status === 404) return { kind: "greska", code: "not_found" };
  if (code === "client_rejected" || status === 400 || status === 413 || status === 415 || status === 422)
    return { kind: "greska", code: "invalid" };
  return UNKNOWN;
}

/** teacher.deadline-extensions.get: the extensions of an assignment, oldest first. */
export async function readDeadlineExtensions(
  client: Api, assignmentId: string,
): Promise<Read<{ kind: "ready"; extensions: readonly DeadlineExtension[] }>> {
  try {
    const result = await client("teacher.deadline-extensions.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) {
      const f = failure(result.status, result.code);
      return f.kind === "greska" && f.code === "invalid" ? UNKNOWN : f;
    }
    return { kind: "ready", extensions: result.body.extensions };
  } catch {
    return UNKNOWN;
  }
}

/** The students the form offers, from teacher.assignment-overview.get; null when they cannot be read. */
export async function readExtensionStudents(client: Api, assignmentId: string): Promise<readonly ExtensionStudent[] | null> {
  try {
    const result = await client("teacher.assignment-overview.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) return null;
    return result.body.students.map((s) => ({
      studentId: s.studentId,
      name: s.givenName === null || s.familyName === null ? null : `${s.givenName} ${s.familyName}`,
    }));
  } catch {
    return null;
  }
}

/** The body the form sends, or null when it cannot be sent as typed. */
export function extensionBody(draft: ExtensionDraft):
  | { scope: "one"; studentId: string; dueAt: string; reasonId: "justified" | "technical" | "agreement" }
  | { scope: "all"; dueAt: string; reasonId: ExtensionReason }
  | null {
  const dueAt = draft.dueAt;
  if (dueAt === null || !INSTANT.test(dueAt) || !(EXTENSION_REASONS as readonly string[]).includes(draft.reasonId)) return null;
  const reasonId = draft.reasonId as ExtensionReason;
  if (draft.scope === "all") return { scope: "all", dueAt, reasonId };
  if (draft.studentId === "" || reasonId === "all") return null;
  return { scope: "one", studentId: draft.studentId, dueAt, reasonId };
}

/** teacher.deadline-extension.post: a success only when the answer is this extension (B-6). */
export async function recordDeadlineExtension(client: Api, assignmentId: string, draft: ExtensionDraft): Promise<RecordOutcome> {
  const body = extensionBody(draft);
  if (body === null) return { kind: "greska", code: "invalid" };
  try {
    const result = await client("teacher.deadline-extension.post", { params: { assignmentId }, query: undefined, body });
    if (!result.ok) return failure(result.status, result.code);
    const { extension, existingSubmissionsUnchanged } = result.body;
    const sameStudent = body.scope === "all" ? extension.studentId === null : extension.studentId === body.studentId.toLowerCase();
    if (result.status !== 201 || extension.scope !== body.scope || !sameStudent || extension.dueAt !== body.dueAt) return UNKNOWN;
    return { kind: "zabiljezeno", extension, existingSubmissionsUnchanged };
  } catch {
    return UNKNOWN;
  }
}
