/**
 * "Započni rad" from the student's side (WEB-1402; plan M2.1, DAN-330, F-137):
 * a work exists only after the student's own click, which calls
 * the start route of the assignment (its path is in api.ts). The server makes the work once per
 * (assignment, student) and answers the same work to every later call, so a
 * second click, a double click or a second tab open the same work.
 *
 * Every state is the server's answer (B-6): nothing is "started" before the
 * answer names the same assignment. The route is not in the contract release
 * this repo pins yet (TODO(ugovor)); the shape below is the smallest one the
 * plan needs (the work, whether this call made it, the language of the work
 * and the version of the faculty rules it is written under) and is closed: an
 * answer with any other field is "nepoznato", never a started work.
 *
 * A refusal is told apart only as far as the screen needs it: 401 and 403
 * lead to the no-access screen of WEB-1401 with their own kind, 404 leads to
 * the same screen as "denied" (another student's and an unknown assignment
 * look the same), and 409 `not_accepting` means the notice must be
 * acknowledged first (PRODUCT §5 rule 6).
 */

import { startWorkCall, type StartWorkTransport } from "./api";
import { accessFailureOf, type AccessFailure } from "./session";
import { matchesSchema, type Schema } from "./schema-check";

export type WorkLanguage = "hr" | "en";

export type StartedWork = {
  readonly assignmentId: string;
  readonly documentId: string;
  /** True only for the call that made the work; every later call answers false. */
  readonly created: boolean;
  readonly workLanguage: WorkLanguage;
  /** The version of the faculty rules the work is written under (M2.12, D-117). */
  readonly facultyRulesVersion: number;
};

export type StartOutcome =
  | { readonly kind: "zapocet"; readonly work: StartedWork }
  /** 401 or 403: the no-access screen of WEB-1401 in that kind. */
  | { readonly kind: "bez-pristupa"; readonly access: AccessFailure }
  /** 404: foreign, unknown or not a student's assignment; shown as "denied", never as "does not exist". */
  | { readonly kind: "nije-pronaden" }
  /** 409 not_accepting: the current notice is not acknowledged yet. */
  | { readonly kind: "prvo-obavijest" }
  /** 408, 5xx, a broken connection, any other shape: the work may have been made. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID = { type: "string", pattern: UUID_PATTERN.source } as const;
export const WORK_LANGUAGES: readonly WorkLanguage[] = ["hr", "en"];

// TODO(ugovor): local shape until the route is in the contract.
const STARTED: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["assignmentId", "documentId", "created", "workLanguage", "facultyRulesVersion"],
  properties: {
    assignmentId: UUID,
    documentId: UUID,
    created: { type: "boolean" },
    workLanguage: { anyOf: WORK_LANGUAGES.map((value) => ({ const: value })) },
    facultyRulesVersion: { type: "integer", minimum: 1 },
  },
};

/** The assignment id in the lowercase form the server uses, or null when it is not a UUID (nothing is sent then). */
export function assignmentIdToSend(raw: string): string | null {
  const id = raw.toLowerCase();
  return UUID_PATTERN.test(id) ? id : null;
}

/** One call of the route, start to end. Never throws. */
export async function startWork(call: StartWorkTransport, rawAssignmentId: string): Promise<StartOutcome> {
  const assignmentId = assignmentIdToSend(rawAssignmentId);
  // A malformed id can name no assignment: the same screen as an unknown one, with no request.
  if (assignmentId === null) return { kind: "nije-pronaden" };
  try {
    const result = await call(assignmentId);
    if (result.ok) {
      // 201 for the call that made the work, 200 for every later one.
      if (result.status !== 200 && result.status !== 201) return UNKNOWN;
      if (!matchesSchema(STARTED, result.body)) return UNKNOWN;
      const work = result.body as StartedWork;
      if (work.assignmentId !== assignmentId) return UNKNOWN;
      if (work.created !== (result.status === 201)) return UNKNOWN;
      return { kind: "zapocet", work };
    }
    const access = accessFailureOf({ status: result.status, code: result.code });
    if (access !== null) return { kind: "bez-pristupa", access };
    if (result.status === 404) return { kind: "nije-pronaden" };
    if (result.status === 409 && result.code === "not_accepting") return { kind: "prvo-obavijest" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

const inFlight = new Map<string, Promise<StartOutcome>>();

/**
 * startWork with at most one call in flight per assignment in this page: a
 * double click, or two buttons for the same assignment, share the first call's
 * answer instead of sending a second request. The server is idempotent anyway;
 * this keeps the click from racing itself.
 */
export function startWorkOnce(call: StartWorkTransport, rawAssignmentId: string): Promise<StartOutcome> {
  const key = assignmentIdToSend(rawAssignmentId) ?? rawAssignmentId;
  const pending = inFlight.get(key);
  if (pending !== undefined) return pending;
  const started = startWork(call, rawAssignmentId).finally(() => inFlight.delete(key));
  inFlight.set(key, started);
  return started;
}

export { startWorkCall, type StartWorkTransport };
