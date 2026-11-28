// ED-126 (prototype text2.js `t2Pg`, "Procjena stranica u rubu"): where a printed page would roughly
// begin, from the number of words (350 a page). Only an estimate; Word gives the true page at export.
// The choice is the person's, kept in this browser; the view menu turns it on and off.
import type { Node as PmNode } from "@tiptap/pm/model";

export const WORDS_PER_PAGE = 350;
const KEY = "ductura:editor:page-estimate";
const EVENT = "ductura:page-estimate";

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The top-level text blocks where page 2, 3, ... would begin, as in the prototype. */
export function pageStarts(doc: PmNode, perPage = WORDS_PER_PAGE): { pos: number; page: number }[] {
  const out: { pos: number; page: number }[] = [];
  let total = 0;
  let next = perPage;
  doc.forEach((node, offset) => {
    const count = words(node.textContent);
    if (total + count >= next && node.isTextblock) {
      const page = Math.floor((total + count) / perPage) + 1;
      next = page * perPage;
      out.push({ pos: offset + 1, page });
    }
    total += count;
  });
  return out;
}

export function readPageEstimate(): boolean {
  try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function keepPageEstimate(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* the choice lasts this visit */ }
  window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: on }));
}

/** Follows the choice made in the view menu; returns the function that stops following. */
export function watchPageEstimate(on: (value: boolean) => void): () => void {
  const heard = (event: Event) => on((event as CustomEvent<boolean>).detail);
  window.addEventListener(EVENT, heard);
  return () => window.removeEventListener(EVENT, heard);
}
