// WEB-2128: "Brzi skok" (plus.js): the search box over the structure and the
// chips that cycle through places in the work.
import { assistHr as t } from "./messages.hr";
import { norm, type AssistChapter } from "./blocks";

export type JumpKind = "hole" | "comment" | "plain" | "figure" | "obs";
export type JumpPlace = { readonly chapterId: string };
export type JumpChip = { readonly kind: JumpKind; readonly label: string; readonly places: readonly JumpPlace[] };

/** Headings that match the query; every heading when the query is empty. */
export function filterHeadings(chapters: readonly AssistChapter[], query: string): AssistChapter[] {
  const q = norm(query).trim();
  if (q === "") return [...chapters];
  const hits = new Set(chapters.filter((c) => norm(c.title).includes(q)).map((c) => c.id));
  // A hit keeps its parent so the structure stays readable.
  return chapters.filter((c) => hits.has(c.id) || (c.parentId !== null ? false : chapters.some((s) => s.parentId === c.id && hits.has(s.id))));
}

/** Chips with a count; a kind without places is left out (a kind the editor cannot count is not offered). */
export function chipsOf(places: Readonly<Partial<Record<JumpKind, readonly JumpPlace[]>>>): JumpChip[] {
  const labels: Record<JumpKind, (n: number) => string> = { hole: t.jump.hole, comment: t.jump.comment, plain: t.jump.plain, figure: t.jump.figure, obs: t.jump.obs };
  return (Object.keys(labels) as JumpKind[]).flatMap((kind) => {
    const list = places[kind] ?? [];
    return list.length === 0 ? [] : [{ kind, label: labels[kind](list.length), places: list }];
  });
}

/** The next place after `cursor`, wrapping round; null when there is none. */
export function nextPlace(places: readonly JumpPlace[], cursor: number): { place: JumpPlace; cursor: number } | null {
  if (places.length === 0) return null;
  const at = (cursor + 1) % places.length;
  return { place: places[at]!, cursor: at };
}
