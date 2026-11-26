// F4-PM1-R02: the real transport of the teacher's proposals. The panel and suggestion-api.ts speak
// `suggestions/{list|create|accept|reject|withdraw}`; this adapter maps those calls onto the
// contract operations collaboration.suggestions-list / suggestions / suggestion-accept /
// suggestion-reject (all POST), through createApi, so nothing leaves the contract and a reply
// that is not exactly the documented shape is answered as nothing (the panel says "unavailable").
// The contract has no withdraw route and no row counter: withdraw is answered as nothing (honest
// "unavailable", never a made-up success) and `row_seq` of a listed row is the constant 1, which
// no contract call carries back.
import { createApi, type ApiOptions, type ApiOperationId, type Input } from "../../../../../../src/client/api";
import type { Transport } from "@/components/editor/suggestions";

type Reply = Awaited<ReturnType<Transport>>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Call = { id: ApiOperationId; body: Record<string, unknown> };

/** The contract call for a panel call; null for an action the contract does not have or a body out of shape. */
function callFor(path: string, body: Record<string, unknown>): Call | null {
  switch (path) {
    case "suggestions/list":
      return typeof body.document_id === "string"
        ? { id: "collaboration.suggestions-list.post", body: { documentId: body.document_id } } : null;
    case "suggestions/create":
      return typeof body.document_id === "string" && typeof body.replacement === "string" && isObject(body.anchor)
        ? { id: "collaboration.suggestions.post", body: { anchor: body.anchor, documentId: body.document_id, text: body.replacement } } : null;
    case "suggestions/accept":
    case "suggestions/reject":
      return typeof body.suggestion_id === "string"
        ? { id: path === "suggestions/accept" ? "collaboration.suggestion-accept.post" : "collaboration.suggestion-reject.post",
          body: { suggestionId: body.suggestion_id } } : null;
    default:
      return null;
  }
}

/** The legacy list row the panel parses, from a row of the contract list (anything else: null). */
function legacyRow(row: unknown): Record<string, unknown> | null {
  if (!isObject(row)) return null;
  const { suggestionId, anchor, text, state, isOwn, createdWindow } = row;
  if (typeof suggestionId !== "string" || typeof text !== "string" || typeof state !== "string"
    || typeof isOwn !== "boolean" || typeof createdWindow !== "string") return null;
  return { anchor, id: suggestionId, is_own: isOwn, opened_window: createdWindow, replacement: text, row_seq: 1, state };
}

/** `options` is for tests and other origins; the page's own origin and fetch by default. */
export function createProposalsPort(options: ApiOptions = {}): Transport {
  return async (path, body): Promise<Reply> => {
    const call = callFor(path, body);
    if (call === null) return null;
    try {
      const input = { params: undefined, query: undefined, body: call.body } as unknown as Input<ApiOperationId>;
      const result = await createApi(options)(call.id as never, input as never) as
        { ok: boolean; status: number; body?: unknown };
      // A failed result with a success status (the API refused an answer out of contract) is no answer.
      if (!result.ok) return result.status >= 400 ? { status: result.status, body: null } : null;
      if (call.id === "collaboration.suggestions-list.post") {
        const rows = isObject(result.body) && Array.isArray(result.body.suggestions) ? result.body.suggestions as unknown[] : null;
        const mapped = rows?.map(legacyRow) ?? null;
        return mapped && mapped.every((r) => r !== null) ? { status: 200, body: { suggestions: mapped } } : null;
      }
      return { status: result.status === 204 ? 200 : result.status, body: result.body ?? {} };
    } catch {
      return null;
    }
  };
}

export const proposalsPort: Transport = createProposalsPort();
