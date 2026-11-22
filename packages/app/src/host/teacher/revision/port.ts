// Transport of the teacher's revision request. list, accept and reopen are the contract's
// collaboration.revision-requests.post; `create` is not wired: its body needs a text anchor and has no
// deadline field, so nothing is invented and sending answers "unavailable" (PITANJE on Ductus#2052).
import { createApi, type ApiOptions, type Input } from "@/client/api";
import { listRevisionRequests, type RevisionListOutcome, type RevisionRequest } from "@/client/revision-requests";
import { acceptBody, reopenBody, type RevisionBody } from "./model";

export type ActionOutcome = "ok" | "signedOut" | "forbidden" | "conflict" | "invalid" | "unavailable";

export type RevisionPort = {
  list(documentId: string, current: () => boolean): Promise<RevisionListOutcome>;
  create(documentId: string, body: RevisionBody): Promise<ActionOutcome>;
  accept(request: RevisionRequest): Promise<ActionOutcome>;
  reopen(request: RevisionRequest): Promise<ActionOutcome>;
};

async function send(action: "accept" | "reopen", body: object | null, options?: ApiOptions): Promise<ActionOutcome> {
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

export const revisionPort: RevisionPort = {
  list: (documentId, current) => listRevisionRequests(documentId, current),
  create: async () => "unavailable",
  accept: (request) => send("accept", acceptBody(request)),
  reopen: (request) => send("reopen", reopenBody(request)),
};
