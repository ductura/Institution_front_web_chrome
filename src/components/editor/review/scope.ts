/**
 * The scope of the Pregled card (E§3.5 review2): the whole work or one
 * chapter, a chapter with its subchapters. Findings of the whole work are
 * made once; the scope only chooses which of them are shown.
 */

import type { Finding } from "./checks";
import type { ReviewDoc } from "./model";

export type Scope = { readonly kind: "all" } | { readonly kind: "chapter"; readonly id: string };

export const WHOLE_WORK: Scope = { kind: "all" };

/** The scope still exists in the document; otherwise the whole work. */
export function validScope(doc: ReviewDoc, scope: Scope): Scope {
  return scope.kind === "chapter" && !doc.chapters.some((chapter) => chapter.id === scope.id) ? WHOLE_WORK : scope;
}

/** Blocks of the chapter with `id` as [first, end), or null when there is none. */
export function chapterRange(doc: ReviewDoc, id: string): { first: number; end: number } | null {
  const chapter = doc.chapters.find((item) => item.id === id);
  return chapter ? { first: chapter.block, end: chapter.end } : null;
}

export function inScope(doc: ReviewDoc, scope: Scope, finding: Finding): boolean {
  if (scope.kind === "all") return true;
  const range = chapterRange(doc, scope.id);
  return range !== null && finding.block >= range.first && finding.block < range.end;
}
