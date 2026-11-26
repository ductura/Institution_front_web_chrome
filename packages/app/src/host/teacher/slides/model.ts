// WEB-V13-NASTAVNIK-PREGLED: pure logic of the teacher's slides reading. A revision's document is shown only
// from the exact bytes the server sent (verifySlidesSnapshot); the comparison of two revisions is made here, on
// the level of slides (added, removed, changed). Nothing is ranked, marked or counted per person.
import { verifySlidesSnapshot, type Slide, type SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";

export type ReadRevision =
  | { readonly kind: "ready"; readonly revision: number; readonly document: SlidesDocument }
  | { readonly kind: "invalid" };

/** A revision's `document` text (canonical JSON from the server) becomes a slides document, or "invalid". */
export async function parseRevisionDocument(revision: number, text: string): Promise<ReadRevision> {
  const verified = await verifySlidesSnapshot(new TextEncoder().encode(text));
  return verified.ok ? { kind: "ready", revision, document: verified.document } : { kind: "invalid" };
}

export type ChangePart = "layout" | "blocks" | "notes" | "position";

export type SlideChange =
  | { readonly kind: "added"; readonly slide: Slide; readonly index: number }
  | { readonly kind: "removed"; readonly slide: Slide; readonly index: number }
  | { readonly kind: "changed"; readonly before: Slide; readonly after: Slide; readonly parts: readonly ChangePart[]; readonly index: number };

export type SlidesComparison = {
  readonly changes: readonly SlideChange[];
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Slides are matched by id. `index` is the 0-based place in the newer document for added and changed slides
 * and in the older one for removed slides. A slide that only moved relative to the slides that stayed is
 * "changed" with the part "position"; the others stay in the order of the newer document, removed ones last.
 */
export function compareSlides(older: SlidesDocument, newer: SlidesDocument): SlidesComparison {
  const before = new Map(older.slides.map((slide, index) => [slide.id, { slide, index }]));
  const after = new Set(newer.slides.map((slide) => slide.id));
  const kept = older.slides.filter((slide) => after.has(slide.id)).map((slide) => slide.id);
  const keptNow = newer.slides.filter((slide) => before.has(slide.id)).map((slide) => slide.id);
  const changes: SlideChange[] = [];
  newer.slides.forEach((slide, index) => {
    const old = before.get(slide.id);
    if (old === undefined) { changes.push({ kind: "added", slide, index }); return; }
    const parts: ChangePart[] = [];
    if (old.slide.layout !== slide.layout) parts.push("layout");
    if (!same(old.slide.blocks, slide.blocks)) parts.push("blocks");
    if ((old.slide.notes ?? "") !== (slide.notes ?? "")) parts.push("notes");
    if (kept.indexOf(slide.id) !== keptNow.indexOf(slide.id)) parts.push("position");
    if (parts.length > 0) changes.push({ kind: "changed", before: old.slide, after: slide, parts, index });
  });
  older.slides.forEach((slide, index) => { if (!after.has(slide.id)) changes.push({ kind: "removed", slide, index }); });
  const count = (kind: SlideChange["kind"]) => changes.filter((change) => change.kind === kind).length;
  return { changes, added: count("added"), removed: count("removed"), changed: count("changed") };
}

/** The first text of a slide (its title block, else the first text found), for the list; null when it has none. */
export function slideTitle(slide: Slide): string | null {
  const text = (block: Slide["blocks"][number]): string | null =>
    block.type === "heading" || block.type === "paragraph" ? block.text : block.type === "list" ? (block.items[0] ?? null) : null;
  const titled = slide.blocks.find((block) => block.slot === "title");
  const found = (titled !== undefined ? text(titled) : null) ?? slide.blocks.map(text).find((value) => value !== null && value !== "") ?? null;
  return found === null || found === "" ? null : found;
}
