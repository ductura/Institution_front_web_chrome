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

/** The parts of a ProseMirror node the word count reads. */
export type WordsNode = {
  readonly isTextblock: boolean;
  readonly content: { readonly size: number };
  textBetween(from: number, to: number, blockSeparator?: string, leafText?: string): string;
  descendants(fn: (node: WordsNode) => boolean | void): void;
};

/** Words of one text block; a leaf inside it (a hard line break) separates words like a space. */
const textblockWords = (node: WordsNode): number => textWords(node.textBetween(0, node.content.size, " ", " "));

/**
 * Words of a node, counted block by block: the node's own textContent joins blocks without a space,
 * so "a b" and "c d" would read as three words (#631 review, point 1), and it drops a hard line break,
 * so "a<br>b" would read as one word (#631 review, c.7144836874).
 */
export function nodeWords(node: WordsNode): number {
  if (node.isTextblock) return textblockWords(node);
  let words = 0;
  node.descendants((child) => {
    if (!child.isTextblock) return true;
    words += textblockWords(child);
    return false;
  });
  return words;
}

/** Words of the whole document. */
export const docWords = (doc: WordsNode): number => nodeWords(doc);
