// NZ-13 (WEB-NF4-KOLEGIJ): the state of a course's enrolment code, its deadline and its revocation, without React.
// Routes: institution.enrollment-code-state.get (current: null | { validUntil }) and
// institution.enrollment-code-revocation.post (revoked: boolean). The code itself is never read back (A-8):
// it lives only in the one answer that issued it. No network call here; the card passes the transport.
import { defaultValidUntil, validUntilInstant } from "../../../../../../src/components/teacher/kolegiji/course-codes";
import { assignmentCardMessages as t } from "./messages.hr";
import { dueText } from "./model";

export type CodeState =
  | { readonly kind: "unknown" }
  | { readonly kind: "none" }
  | { readonly kind: "valid" | "expired"; readonly validUntil: string };

type Answer =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly code?: string };

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** The state the server's answer says, against `now`; a broken or failed answer is "unknown", never "none". */
export function codeStateOf(answer: Answer, now: number): CodeState {
  if (!answer.ok) return { kind: "unknown" };
  const body = answer.body as { current?: unknown } | null;
  if (body === null || typeof body !== "object" || !("current" in body)) return { kind: "unknown" };
  if (body.current === null) return { kind: "none" };
  const until = (body.current as { validUntil?: unknown } | undefined)?.validUntil;
  if (typeof until !== "string" || !INSTANT.test(until) || Number.isNaN(Date.parse(until))) return { kind: "unknown" };
  return { kind: Date.parse(until) > now ? "valid" : "expired", validUntil: until };
}

/** The words of the "Kod za upis" field; a collaborator is told who issues it. */
export function codeStateText(state: CodeState): string {
  switch (state.kind) {
    case "valid": return t.codeValidUntil(dueText(state.validUntil));
    case "expired": return t.codeExpiredAt(dueText(state.validUntil));
    case "none": return t.codeNone;
    default: return t.codeUnknown;
  }
}

/** "Opozovi kod" is offered only while a code is valid. */
export const canRevoke = (state: CodeState): boolean => state.kind === "valid";

export type Revocation = "revoked" | "nothing" | "signedOut" | "forbidden" | "unavailable";

/** The revocation answer as the dialog says it; `revoked: false` means there was nothing to revoke. */
export function revocationOf(answer: Answer): Revocation {
  if (answer.ok) {
    const revoked = (answer.body as { revoked?: unknown } | null)?.revoked;
    return revoked === true ? "revoked" : revoked === false ? "nothing" : "unavailable";
  }
  return answer.status === 401 ? "signedOut" : answer.status === 403 ? "forbidden" : "unavailable";
}

/** The deadline field's first value: two weeks ahead, the end of that day (the dialog's old default). */
export const firstValidUntil = defaultValidUntil;

/**
 * The instant the teacher chose, or the reason there is none: an empty or impossible minute, or one that is not in
 * the future (a code that is expired on arrival would only confuse the students).
 */
export function chosenInstant(local: string, now: number): { readonly ok: true; readonly instant: string } | { readonly ok: false } {
  const instant = validUntilInstant(local);
  return instant !== null && Date.parse(instant) > now ? { ok: true, instant } : { ok: false };
}
