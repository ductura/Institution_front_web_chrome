/**
 * The calls of the suggestion route. The transport is injected (the page passes
 * the API bridge, a test passes a probe answer): this module makes no request
 * of its own, so data reaches the page only through the API bridge. The client never
 * names an author, a role or a state; the database takes them from the session.
 * A stale `expectedSeq` is answered 409 and is shown, never retried with a
 * newer counter.
 */

import { suggestionsFromList, type Suggestion } from "./suggestion";

export type Reply = { readonly status: number; readonly body: unknown } | null;
export type Transport = (path: string, body: Record<string, unknown>) => Promise<Reply>;

export type ListOutcome =
  | { kind: "ok"; suggestions: Suggestion[] }
  | { kind: "signedOut" | "forbidden" | "unavailable" };
export type ActionOutcome = "ok" | "signedOut" | "forbidden" | "conflict" | "invalid" | "unavailable";
export type Decision = "accept" | "reject" | "withdraw";

// The transport prefixes the API root; this module names only the route and its action.
const PATH = "suggestions/";

function failure(reply: Reply): Exclude<ActionOutcome, "ok"> {
  switch (reply?.status) {
    case 401: return "signedOut";
    case 403: return "forbidden";
    case 409: return "conflict";
    case 400: case 422: return "invalid";
    default: return "unavailable";
  }
}

export async function listSuggestions(send: Transport, documentId: string): Promise<ListOutcome> {
  const reply = await send(`${PATH}list`, { document_id: documentId });
  if (reply?.status === 200) {
    const suggestions = suggestionsFromList(reply.body);
    return suggestions ? { kind: "ok", suggestions } : { kind: "unavailable" };
  }
  const out = failure(reply);
  return out === "signedOut" || out === "forbidden" ? { kind: out } : { kind: "unavailable" };
}

export async function decideSuggestion(
  send: Transport, suggestion: Pick<Suggestion, "id" | "rowSeq">, decision: Decision,
): Promise<ActionOutcome> {
  const reply = await send(`${PATH}${decision}`, { suggestion_id: suggestion.id, expected_seq: suggestion.rowSeq });
  return reply?.status === 200 ? "ok" : failure(reply);
}

export async function createSuggestion(
  send: Transport, documentId: string, anchor: Suggestion["anchor"], replacement: string,
): Promise<ActionOutcome> {
  const reply = await send(`${PATH}create`, { document_id: documentId, anchor, replacement });
  return reply?.status === 200 || reply?.status === 201 ? "ok" : failure(reply);
}
