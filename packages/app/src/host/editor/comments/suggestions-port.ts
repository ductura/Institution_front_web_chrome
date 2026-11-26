// EDI-R10: the student's side of the teacher's text proposals, over the generated client
// (collaboration.suggestions-list / -accept / -reject.post). The route is called as the contract
// gives it; the client never names an author, a role or a state. A list that is not exactly the
// documented shape is unavailable as a whole (never shown in part), and a refusal is never shown as
// "no proposals". The contract has no row counter, so `rowSeq` of the card model is a fixed 1 that
// no request carries (assumption, recorded in the PR).
import { createApi, type ApiOptions } from "../../../../../../src/client/api.ts";
import { suggestionsFromList, type ActionOutcome, type Suggestion } from "../../../../../../src/components/editor/suggestions/index.ts";

export type ProposalsRead =
  | { readonly kind: "ok"; readonly suggestions: readonly Suggestion[] }
  | { readonly kind: "signedOut" | "forbidden" | "unavailable" };

const outcomeOf = (status: number): Exclude<ActionOutcome, "ok"> => {
  switch (status) {
    case 401: return "signedOut";
    case 403: case 404: return "forbidden";
    case 409: return "conflict";
    case 400: case 422: return "invalid";
    default: return "unavailable";
  }
};

export async function readProposals(documentId: string, options: ApiOptions = {}): Promise<ProposalsRead> {
  try {
    const answer = await createApi(options)("collaboration.suggestions-list.post", { params: undefined, query: undefined, body: { documentId } });
    if (!answer.ok) return { kind: answer.status === 401 ? "signedOut" : answer.status === 403 ? "forbidden" : "unavailable" };
    // Re-shaped to the card model, then checked by the model's own reader: any row out of shape voids the list.
    const suggestions = suggestionsFromList({
      suggestions: answer.body.suggestions.map((s) => ({
        id: s.suggestionId, state: s.state, row_seq: 1, anchor: s.anchor, replacement: s.text, is_own: s.isOwn, opened_window: s.createdWindow,
      })),
    });
    return suggestions ? { kind: "ok", suggestions } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Accept or reject one proposal; a throw or an answer of another status is never "ok". */
export async function decideProposal(suggestionId: string, decision: "accept" | "reject", options: ApiOptions = {}): Promise<ActionOutcome> {
  try {
    const call = createApi(options);
    if (decision === "accept") {
      const answer = await call("collaboration.suggestion-accept.post", { params: undefined, query: undefined, body: { suggestionId } });
      return answer.ok ? (answer.status === 200 ? "ok" : "unavailable") : outcomeOf(answer.status);
    }
    const answer = await call("collaboration.suggestion-reject.post", { params: undefined, query: undefined, body: { suggestionId } });
    return answer.ok ? (answer.status === 204 ? "ok" : "unavailable") : outcomeOf(answer.status);
  } catch {
    return "unavailable";
  }
}
