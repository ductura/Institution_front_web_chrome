import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { numberedHeadings } from "@/editor";

export function reviewPlaces(doc: ProseMirrorNode) {
  const headings = new Map(numberedHeadings(doc).map(({ pos, number }) => [pos, number]));
  const places: { from: number; to: number; chapter: string | undefined; context: string }[] = [];
  let chapter: string | undefined;

  doc.forEach((block, offset) => {
    chapter = headings.get(offset) ?? chapter;
    if (!block.isTextblock) return;
    // Preserve document positions and prevent a match spanning an inline atom.
    const text = block.textBetween(0, block.content.size, "", "\uFFFC");
    for (const match of text.matchAll(/\[(?:\?|izvor|provjeri|broj|stranica|citat)[^\]\uFFFC]{0,40}\]/giu)) {
      const start = match.index;
      const end = start + match[0].length;
      const context = text.slice(Math.max(0, start - 30), end + 30).replaceAll("\uFFFC", " ").trim();
      places.push({ from: offset + 1 + start, to: offset + 1 + end, chapter, context });
    }
  });

  return places;
}
