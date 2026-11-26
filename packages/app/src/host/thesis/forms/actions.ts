// WEB-V16-OBRASCI: the writes (a form's state, the mentor's consent). The result is read only from the server's
// answer (B-6); the same state twice is a message ("unchanged"), not an error, and the student's allowed moves
// are checked before any request (the server stays the authority and answers 403/409).
import type { Call, FormState, ThesisForm } from "./read";
import type { ThesisRole } from "../model";

export type Outcome = "saved" | "unchanged" | "forbidden" | "conflict" | "notFound" | "invalid" | "signedOut" | "unknown";
export const COMMENT_MAX = 1000;

/** The states a role may set on a form now: the student only flips not_submitted ↔ submitted, and never touches an accepted form. */
export function allowedStates(role: ThesisRole, current: FormState): FormState[] {
  if (role === "mentor") return (["not_submitted", "submitted", "accepted"] as const).filter((s) => s !== current);
  if (current === "accepted") return [];
  return [current === "submitted" ? "not_submitted" : "submitted"];
}

function outcomeOf(a: { ok: boolean; status?: number }): Outcome {
  if (a.ok) return "saved";
  switch (a.status) {
    case 401: return "signedOut";
    case 403: return "forbidden";
    case 404: return "notFound";
    case 409: return "conflict";
    case 422: return "invalid";
    default: return "unknown";
  }
}

export async function setFormState(call: Call, documentId: string, role: ThesisRole, form: ThesisForm, state: FormState): Promise<Outcome> {
  if (state === form.state) return "unchanged";
  if (!allowedStates(role, form.state).includes(state)) return "forbidden";
  try {
    return outcomeOf(await call("work.thesis-form.put", { params: { documentId, code: form.code }, query: undefined, body: { state } }));
  } catch { return "unknown"; }
}

export async function setConsent(call: Call, documentId: string, role: ThesisRole, current: "none" | "given" | "withdrawn", given: boolean, comment: string): Promise<Outcome> {
  if (role !== "mentor") return "forbidden";
  if ((given && current === "given") || (!given && current === "withdrawn")) return "unchanged";
  const text = comment.trim();
  if (text.length > COMMENT_MAX) return "invalid";
  const body = text === "" ? { given } : { given, comment: text };
  try {
    return outcomeOf(await call("work.mentor-consent.put", { params: { documentId }, query: undefined, body }));
  } catch { return "unknown"; }
}
