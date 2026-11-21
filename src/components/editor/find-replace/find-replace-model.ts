import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import {
  QUOTE,
  replaceAllTransaction,
  replaceMatchTransaction,
  searchDocument,
  type ReplaceOutcome,
  type SearchMatch,
  type SearchResult,
} from "@/editor";

/**
 * The host side of find and replace (WEB-1605 part 2, M5.10, DAN-409). The
 * search and the transactions are editor-core's (`find-replace.ts`); this
 * adds the one rule of the plan the core does not know: text inside a quote
 * from a source (a `quote` block) is found but never replaced.
 *
 * "Replace all" stays one transaction, so one undo takes it back, and the
 * result keeps the searched document, so a change after the search is still
 * refused as `stale`.
 */

export type HostOutcome =
  | ReplaceOutcome
  | Readonly<{ ok: false; reason: "in_quote" }>;

/** True when the match lies in a quote from a source. */
export function inSourceQuote(doc: ProseMirrorNode, match: SearchMatch): boolean {
  return doc.resolve(match.from).parent.type.name === QUOTE;
}

/** The literal matches of `text`, or null for a query that cannot be stored. */
export function findMatches(doc: ProseMirrorNode, text: string, matchCase: boolean): SearchResult | null {
  return searchDocument(doc, { text, matchCase });
}

/** The same result without the matches inside source quotes. */
export function replaceableResult(result: SearchResult): SearchResult {
  return { ...result, matches: result.matches.filter((match) => !inSourceQuote(result.doc, match)) };
}

/** Replaces the match at `index` of `result`, unless it is inside a source quote. */
export function replaceOne(state: EditorState, result: SearchResult, index: number, replacement: string): HostOutcome {
  const match = result.matches[index];
  if (match !== undefined && state.doc === result.doc && inSourceQuote(result.doc, match)) {
    return { ok: false, reason: "in_quote" };
  }
  const replaceable = replaceableResult(result);
  const at = match === undefined ? -1 : replaceable.matches.indexOf(match);
  return replaceMatchTransaction(state, replaceable, at, replacement);
}

/** Replaces every match of `result` outside source quotes, in one transaction. */
export function replaceEvery(state: EditorState, result: SearchResult, replacement: string): HostOutcome {
  return replaceAllTransaction(state, replaceableResult(result), replacement);
}
