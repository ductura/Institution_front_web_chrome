// WEB-18 (Ductus#2028 c.7008147932, N-01, dk-h): the rules of the enrolment
// code dialog, without React, on institution.enrollment-code.post and
// institution.enrollment-code-revocation.post. The server stores only the
// code's hash and has no read-back (A-8): the code lives in the one answer
// that issued it, and the page keeps only that a code was issued, and until when.
import { zagrebInstant, zagrebLocalMinute } from "@/lib/i18n/zagreb";

/** How long a new code is offered to stay valid: two weeks, to the end of that day in Zagreb. */
export const DEFAULT_VALID_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The `datetime-local` value the dialog opens with: the day `DEFAULT_VALID_DAYS` from `now`, at 23:59 Zagreb time. */
export function defaultValidUntil(now: number): string {
  return `${zagrebLocalMinute(new Date(now + DEFAULT_VALID_DAYS * DAY_MS).toISOString()).slice(0, 10)}T23:59`;
}

/** The instant the field means, or null for a minute that does not exist in Zagreb (or an empty field). */
export function validUntilInstant(local: string): string | null {
  return zagrebInstant(local);
}

/** What one request of the dialog ends in. */
export type CodeOutcome =
  | { kind: "issued"; code: string }
  | { kind: "revoked"; revoked: boolean }
  | { kind: "signedOut" | "invalid" | "forbidden" | "unavailable" };

type Answer =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly code?: string };

const CODE = /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/;

/**
 * The answer of either route, as the dialog says it. createApi already checked
 * a success against its schema; the shape is checked again so a broken answer
 * is "unavailable", never an empty code. 401 signs out, 403 a course the
 * teacher does not teach, 400/422 a date the server refused (or a request the
 * client refused), anything else unavailable. Nothing is retried: every issue
 * replaces the previous code on the server.
 */
export function codeOutcome(answer: Answer): CodeOutcome {
  if (answer.ok) {
    const body = answer.body as { code?: unknown; revoked?: unknown } | null;
    if (body !== null && typeof body === "object") {
      if (typeof body.code === "string" && CODE.test(body.code)) return { kind: "issued", code: body.code };
      if (typeof body.revoked === "boolean") return { kind: "revoked", revoked: body.revoked };
    }
    return { kind: "unavailable" };
  }
  if (answer.status === 401) return { kind: "signedOut" };
  if (answer.status === 403) return { kind: "forbidden" };
  if (answer.status === 400 || answer.status === 422 || answer.code === "client_rejected") return { kind: "invalid" };
  return { kind: "unavailable" };
}

/** What a course's row says after this visit's dialogs; nothing before the first one. */
export type CodeNote =
  | { kind: "issued"; validUntil: string }
  | { kind: "revoked" | "nothingRevoked" | "unknown" };

/**
 * The note a row keeps after an outcome. A refusal (403, 400/422) changed
 * nothing and leaves the previous note; "unavailable" is an unknown outcome:
 * the server may have replaced or revoked the code, so no earlier code is
 * claimed valid any more.
 */
export function nextNote(previous: CodeNote | null, outcome: CodeOutcome, validUntil: string): CodeNote | null {
  if (outcome.kind === "issued") return { kind: "issued", validUntil };
  if (outcome.kind === "revoked") return { kind: outcome.revoked ? "revoked" : "nothingRevoked" };
  if (outcome.kind === "unavailable") return { kind: "unknown" };
  return previous;
}
