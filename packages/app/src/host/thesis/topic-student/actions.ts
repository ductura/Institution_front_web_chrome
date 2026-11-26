// WEB-V16-TEMA-STUDENT: the student's write (`work.thesis-topic.put`). The draft is checked before any request
// (title 1–200, summary 0–1000 characters, counted in code points like the server); an approved topic is never
// sent again; the result is read only from the server's answer (B-6), and a 409 means the mentor has decided.
import type { ThesisRole } from "../model";
import { parseTopic, type Call, type Topic, type TopicState } from "./read";

export const TITLE_MAX = 200;
export const SUMMARY_MAX = 1000;

export type Outcome = "saved" | "unchanged" | "locked" | "forbidden" | "conflict" | "notFound" | "invalid" | "signedOut" | "unknown";
export type DraftProblem = "titleEmpty" | "titleTooLong" | "summaryTooLong";
export type Result = { outcome: Outcome; topic?: Topic };

export const length = (s: string) => [...s].length;

/** What is wrong with a draft, or null. A title of only blanks is empty. */
export function draftProblem(title: string, summary: string): DraftProblem | null {
  const t = title.trim();
  if (t === "") return "titleEmpty";
  if (length(t) > TITLE_MAX) return "titleTooLong";
  if (length(summary.trim()) > SUMMARY_MAX) return "summaryTooLong";
  return null;
}

/** The form is open in every state except approved. */
export const canPropose = (state: TopicState) => state !== "approved";

function outcomeOf(status: number): Outcome {
  switch (status) {
    case 401: return "signedOut";
    case 403: return "forbidden";
    case 404: return "notFound";
    case 409: return "conflict";
    case 422: return "invalid";
    default: return "unknown";
  }
}

export async function proposeTopic(call: Call, documentId: string, role: ThesisRole, current: Topic, title: string, summary: string): Promise<Result> {
  if (role !== "student") return { outcome: "forbidden" };
  if (!canPropose(current.state)) return { outcome: "locked" };
  if (draftProblem(title, summary) !== null) return { outcome: "invalid" };
  const body = { title: title.trim(), summary: summary.trim() };
  if (current.current !== null && current.current.title === body.title && current.current.summary === body.summary) {
    return { outcome: "unchanged" };
  }
  try {
    const a = (await call("work.thesis-topic.put", { params: { documentId }, query: undefined, body })) as
      { ok: true; body: unknown } | { ok: false; status: number };
    if (!a.ok) return { outcome: outcomeOf(a.status) };
    const topic = parseTopic(a.body);
    return topic === null ? { outcome: "unknown" } : { outcome: "saved", topic };
  } catch { return { outcome: "unknown" }; }
}
