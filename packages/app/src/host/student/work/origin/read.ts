// The one read of the student's "Podrijetlo teksta": work.origin-composition.get from the contract extract, through
// createApi (the same operation the teacher's map reads); createApi also holds the answer to the generated schema.
import { createApi, type ApiOptions } from "@/client/api";
import type { OriginRead } from "../../../teacher/origin-map/contract";

import { readOfParts } from "./model";

const OPERATION = "work.origin-composition.get";

export type OriginReadCall = (documentId: string) => Promise<OriginRead>;

export function originReader(options?: ApiOptions): OriginReadCall {
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

export const readOrigin: OriginReadCall = (documentId) => originReader()(documentId);
