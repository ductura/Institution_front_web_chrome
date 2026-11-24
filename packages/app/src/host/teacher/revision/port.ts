// Transport of the teacher's revision request. list, accept and reopen are the contract's
// collaboration.revision-requests.post; `create` is the whole-work return with the mandatory deadline,
// work.return-for-revision.post (WEB-2155B), because the anchored create has no deadline field.
import { createApi, type ApiOptions, type Input } from "@/client/api";
import { returnStatus } from "@/client/return-for-revision";
import { listRevisionRequests, type RevisionListOutcome, type RevisionRequest } from "@/client/revision-requests";
import { acceptBody, reopenBody, withdrawBody, type RevisionBody } from "./model";

export type ActionOutcome = "ok" | "signedOut" | "forbidden" | "conflict" | "invalid" | "unavailable";

export type RevisionPort = {
  list(documentId: string, current: () => boolean): Promise<RevisionListOutcome>;
  create(documentId: string, body: RevisionBody): Promise<ActionOutcome>;
  accept(request: RevisionRequest): Promise<ActionOutcome>;
  reopen(request: RevisionRequest): Promise<ActionOutcome>;
  withdraw(request: RevisionRequest): Promise<ActionOutcome>;
};

async function send(action: "accept" | "reopen" | "withdraw", body: object | null, options?: ApiOptions): Promise<ActionOutcome> {
  if (body === null) return "invalid";
  try {
    const call = { params: { action }, query: undefined, body } as unknown as Input<"collaboration.revision-requests.post">;
    const result = await createApi(options)("collaboration.revision-requests.post", call);
    if (result.status === 409) return "conflict";
    if (result.ok) return result.status === 200 ? "ok" : "unavailable";
    return result.status === 401 ? "signedOut" : result.status === 403 ? "forbidden" : result.status === 422 ? "invalid" : "unavailable";
  } catch {
    return "unavailable";
  }
}

function outcomeOf(status: number | null): ActionOutcome {
  return status === 200 ? "ok" : status === 401 ? "signedOut" : status === 403 ? "forbidden" : status === 409 ? "conflict" : "unavailable";
}

export const revisionPort: RevisionPort = {
  list: (documentId, current) => listRevisionRequests(documentId, current),
  create: async (documentId, body) => outcomeOf(await returnStatus(documentId, body.instruction, body.dueAt)),
  accept: (request) => send("accept", acceptBody(request)),
  reopen: (request) => send("reopen", reopenBody(request)),
  withdraw: (request) => send("withdraw", withdrawBody(request)),
};
