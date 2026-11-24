// WEB-NF6-RUNDA (NF-6 MK-10): "Priprema za konzultacije" composed in the browser from what the student
// already sees: the last consultation record (date, revision), the change of the text since that revision
// and the requests on the text. No assistant and no conclusion about authorship; a count the page cannot
// know is left out of the text (prepText drops it), never guessed.
import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import type { PrepInput } from "./mentor-model";

/** The largest message work.messages.post takes. */
export const MAX_MESSAGE = 2000;

export type RecordFacts = { readonly heldOn: string; readonly revision: number };
export type BlockChange = { readonly kind: string; readonly change: "unchanged" | "removed" | "added" };

/** The newest record by date; on the same day the later revision. */
export function lastRecord(records: readonly RecordFacts[]): RecordFacts | null {
  return [...records].sort((a, b) => b.heldOn.localeCompare(a.heldOn) || b.revision - a.revision)[0] ?? null;
}

/** Blocks of text (not headings) that are new or rewritten since the compared revision. */
export const changedBlocks = (blocks: readonly BlockChange[]): number =>
  blocks.filter((b) => b.kind !== "heading" && b.change === "added").length;

/** Requests answered since the record (responded or accepted); all of them when there is no record. */
export function resolvedSince(requests: readonly RevisionRequest[], since: string | null): number {
  return requests.filter((r) => {
    if (r.state !== "responded" && r.state !== "accepted") return false;
    const v = r.versions[r.versions.length - 1];
    const at = v?.closed?.window ?? v?.response?.window ?? null;
    return since === null || at === null || at.slice(0, 10) >= since;
  }).length;
}

export type PrepFacts = {
  readonly record: RecordFacts | null;
  /** null when the comparison could not be read or there is nothing to compare with. */
  readonly blocks: readonly BlockChange[] | null;
  readonly requests: readonly RevisionRequest[] | null;
  readonly words: number | null;
};

export function prepFrom(f: PrepFacts): PrepInput {
  const since = f.record?.heldOn ?? null;
  return {
    since,
    changed: f.blocks === null ? null : changedBlocks(f.blocks),
    resolved: f.requests === null ? null : resolvedSince(f.requests, since),
    agreed: [],
    openComments: f.requests === null ? null : f.requests.filter((r) => r.state === "open" || r.state === "reopened").length,
    words: f.words,
    toReview: null,
  };
}

/** Words of a piece of text. */
export const textWords = (text: string): number => text.split(/\s+/).filter((w) => w !== "").length;

type TextBlock = { readonly isTextblock: boolean; readonly textContent: string };

/**
 * Words of the whole document, counted block by block: the document's own textContent joins blocks
 * without a space, so "a b" and "c d" would read as three words (#631 review, point 1).
 */
export function docWords(doc: { descendants(fn: (node: TextBlock) => boolean | void): void }): number {
  let words = 0;
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    words += textWords(node.textContent);
    return false;
  });
  return words;
}
