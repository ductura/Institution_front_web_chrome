// WEB-V16-TEMA-MENTOR: the mentor's decision on the topic. The result is read only from the server's answer
// (B-6). Returning without a comment, a student's attempt and a state that cannot be decided send no request;
// the server stays the authority (403, 404, 409 on a stale version).
import type { ThesisRole } from "../model";
import type { Call, TopicState, TopicValue } from "./read";

export type Decision = "approved" | "returned";
export type Outcome = "saved" | "commentRequired" | "forbidden" | "conflict" | "notFound" | "invalid" | "signedOut" | "unknown";
export const COMMENT_MAX = 1000;

/** What the mentor may decide now: a proposal either way; an approved topic only back, with a reason. */
export function allowedDecisions(role: ThesisRole, state: TopicState): Decision[] {
  if (role !== "mentor") return [];
  if (state === "proposed") return ["approved", "returned"];
  if (state === "approved") return ["returned"];
  return [];
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

/** Decides on the version the mentor has on screen, so a changed topic gives 409 instead of a blind decision. */
export async function decide(call: Call, documentId: string, role: ThesisRole, topic: TopicValue, decision: Decision, comment: string): Promise<Outcome> {
  if (topic.current === null || !allowedDecisions(role, topic.state).includes(decision)) return "forbidden";
  const text = comment.trim();
  if (decision === "returned" && text === "") return "commentRequired";
  if (text.length > COMMENT_MAX) return "invalid";
  const body = text === "" ? { version: topic.current.version, decision } : { version: topic.current.version, decision, comment: text };
  try {
    return outcomeOf(await call("work.thesis-topic-decision.post", { params: { documentId }, query: undefined, body }));
  } catch { return "unknown"; }
}
