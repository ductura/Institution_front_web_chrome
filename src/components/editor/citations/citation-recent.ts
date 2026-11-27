// ED-103 (prototype toolbar2.js cite): "Zadnje korišteni" in the citation popover. The sources the student cited
// last in this session come first, then those cited before the cursor, nearest first; at most three, and only when
// there are more than three sources, so a short list is not repeated.
import type { Node as PmNode } from "@tiptap/pm/model";

const RECENT = 3;
let session: string[] = [];

/** Remembers a cited source for this session, the newest first. */
export function rememberCited(sourceId: string): void {
  session = [sourceId, ...session.filter((id) => id !== sourceId)].slice(0, 10);
}
export const citedThisSession = (): readonly string[] => session;
/** For tests only. */
export function forgetCited(): void { session = []; }

/** The sources cited before `cursor`, the nearest first. */
export function citedBefore(doc: PmNode, cursor: number): string[] {
  const out: string[] = [];
  doc.nodesBetween(0, Math.min(cursor, doc.content.size), (node) => {
    if (node.type.name === "citation" && typeof node.attrs.sourceId === "string") out.push(node.attrs.sourceId);
  });
  return out.reverse();
}

export function recentSources<S extends { id: string }>(sources: readonly S[], recent: readonly string[], before: readonly string[]): S[] {
  if (sources.length <= RECENT) return [];
  return [...new Set([...recent, ...before])]
    .flatMap((id) => sources.filter((s) => s.id === id))
    .slice(0, RECENT);
}
