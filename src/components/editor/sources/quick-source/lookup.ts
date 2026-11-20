import type { SourceDraft } from "@ductura/ui";

import { parseIdentifier, type Identifier } from "./identifier";

/** What the server's source lookup answers, as the client sees it. */
export type LookupAnswer = { status: "found"; draft: SourceDraft } | { status: "not_found" };
/** The client call of the lookup (the server source lookup); it rejects when the call fails. */
export type SourceLookup = (identifier: Identifier) => Promise<LookupAnswer>;

export type LookupOutcome =
  | { state: "found"; draft: SourceDraft }
  | { state: "invalid" | "not_found" | "unavailable" | "failed" };

/** Thrown by a lookup whose route the contract does not have yet. */
export class LookupUnavailable extends Error {}

/** The lookup until the server route exists: a clear "unavailable" state, no request is made. */
export const unavailableLookup: SourceLookup = () => Promise.reject(new LookupUnavailable("source-lookup route missing"));

export async function lookupSource(input: string, lookup: SourceLookup = unavailableLookup): Promise<LookupOutcome> {
  const identifier = parseIdentifier(input);
  if (!identifier) return { state: "invalid" };
  try {
    const answer = await lookup(identifier);
    return answer.status === "found" ? { state: "found", draft: answer.draft } : { state: "not_found" };
  } catch (error) {
    return { state: error instanceof LookupUnavailable ? "unavailable" : "failed" };
  }
}
