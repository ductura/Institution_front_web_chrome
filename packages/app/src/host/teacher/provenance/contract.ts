// The assistant match of one work in "Karta podrijetla" (PIL-P1-PODUDARANJE-KARTA; WEB-1230; P-1 rule 13; SRV-1230).
// Two reads from the contract extract, through createApi, which also holds each answer to the generated schema:
//   work.assistant-match.get     { documentId } -> 200 { findings: [{ segmentRef, conversationId, messageId, runWords, recordedAt, attachedAt }] }
//   work.origin-composition.get  { documentId } -> 200 { parts: [{ kind, percent }] }, for the share of `assistant_match`
// The contract has no flag field: while the faculty flag `assistantMatchEnabled` is off the server computes and
// stores nothing, so there is no finding and no share, and the section does not exist. The student and the
// teacher send the same requests and get the same answer.
import { createApi, type ApiOptions } from "@/client/api";

import { matchOf, type MatchRead } from "./match-model";

export type MatchCall = (documentId: string) => Promise<MatchRead>;

export function assistantMatchReader(options?: ApiOptions): MatchCall {
  return async (documentId) => {
    if (documentId.length === 0) return { kind: "notFound" };
    const call = createApi(options);
    const input = { params: { documentId }, query: undefined, body: undefined };
    try {
      const [findings, composition] = await Promise.all([
        call("work.assistant-match.get", input),
        call("work.origin-composition.get", input),
      ]);
      if (findings.ok && composition.ok) return matchOf(findings.body.findings, composition.body.parts);
      const status = (findings.ok ? null : findings.status) ?? (composition.ok ? null : composition.status);
      if (status === 401) return { kind: "signedOut" };
      // 403 is not in the contract extract; a retry cannot help, so it reads like 404: nothing to show.
      if (status === 404 || status === 403) return { kind: "notFound" };
    } catch {
      return { kind: "unavailable" };
    }
    return { kind: "unavailable" };
  };
}

export const readAssistantMatch: MatchCall = (documentId) => assistantMatchReader()(documentId);
