// The one read of "Karta podrijetla" (WEB-2158): work.origin-composition.get from the contract extract,
// through createApi, which also holds the answer to the generated schema. Only presence of marks is used.
import { createApi, type ApiOptions } from "@/client/api";

import { readOfParts, type ProvenanceRead } from "./model";

const OPERATION = "work.origin-composition.get";

export type ProvenanceCall = (documentId: string) => Promise<ProvenanceRead>;

export function provenanceReader(options?: ApiOptions): ProvenanceCall {
  return async (documentId) => {
    if (documentId.length === 0) return { kind: "notFound" };
    try {
      const answer = await createApi(options)(OPERATION, { params: { documentId }, query: undefined, body: undefined });
      if (answer.ok) return readOfParts(answer.body.parts);
      if (answer.status === 401) return { kind: "signedOut" };
      if (answer.status === 404) return { kind: "notFound" };
    } catch {
      return { kind: "unavailable" };
    }
    return { kind: "unavailable" };
  };
}

export const readProvenance: ProvenanceCall = (documentId) => provenanceReader()(documentId);
