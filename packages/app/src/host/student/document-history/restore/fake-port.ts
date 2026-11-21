// In-memory stand-in for the save path used by restore (WEB-1907); invented data only.
import type { RestoreOutcome, RestorePort } from "./model";

export function fakeRestorePort(answer?: RestoreOutcome): RestorePort & { readonly calls: readonly [string, number, number][] } {
  const calls: [string, number, number][] = [];
  return {
    calls,
    async restore(documentId, fromRevision, baseRevision) {
      calls.push([documentId, fromRevision, baseRevision]);
      return answer ?? { kind: "saved", revision: baseRevision + 1 };
    },
  };
}
