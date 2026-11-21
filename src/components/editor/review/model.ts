/**
 * The review model (WEB-1102): what the checks read of the open document. It
 * is a plain value (blocks with their text, chapters with their range), made
 * from the editor's document by `readReviewDoc` and from plain blocks by
 * `reviewDocOf`, so the checks, the scope and the summary are tested without
 * an editor. Nothing here changes the document or leaves the browser.
 */

import type { Node as PmNode } from "@tiptap/pm/model";
import { numberedHeadings } from "@/editor";

/** What a citation stands for in the text of a block: one visible mark, never a word. */
export const CITATION_MARK = "￼";

export type ReviewBlock = {
  /** The block id of the document, or null before the editor minted it. */
  readonly id: string | null;
  /** Position of the block in the document when it was read. */
  readonly pos: number;
  readonly kind: "heading" | "paragraph" | "quote" | "list" | "other";
  readonly text: string;
  /** Citations inside the block. */
  readonly citations: number;
  /** Heading level, 0 for a block that is not a heading. */
  readonly level: number;
  /** Index into `chapters` of the nearest heading above, -1 before the first. */
  readonly chapter: number;
};

export type ReviewChapter = {
  readonly id: string | null;
  readonly pos: number;
  readonly number: string;
  readonly title: string;
  readonly level: number;
  /** Index of its heading in `blocks`. */
  readonly block: number;
  /** Index one past the last block of the chapter, subchapters included. */
  readonly end: number;
};

export type ReviewDoc = {
  readonly blocks: readonly ReviewBlock[];
  readonly chapters: readonly ReviewChapter[];
};

export type BlockInput = {
  readonly id?: string | null;
  readonly kind: ReviewBlock["kind"];
  readonly text: string;
  readonly level?: number;
  readonly citations?: number;
};

/** The words of a text: runs of letters and digits. */
export function wordCount(text: string): number {
  return (text.replaceAll(CITATION_MARK, " ").match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

/** The model of plain blocks; chapters are numbered 1, 1.1, 1.1.1 as the editor numbers them. */
export function reviewDocOf(inputs: readonly BlockInput[]): ReviewDoc {
  const counters = [0, 0, 0];
  const blocks: ReviewBlock[] = [];
  const chapters: { -readonly [K in keyof ReviewChapter]: ReviewChapter[K] }[] = [];
  inputs.forEach((input, index) => {
    const level = input.kind === "heading" ? Math.min(3, Math.max(1, input.level ?? 1)) : 0;
    if (level > 0) {
      counters[level - 1]! += 1;
      for (let i = level; i < counters.length; i += 1) counters[i] = 0;
      chapters.push({
        id: input.id ?? null, pos: index, number: counters.slice(0, level).join("."), title: input.text.trim(),
        level, block: index, end: inputs.length,
      });
    }
    blocks.push({
      id: input.id ?? null, pos: index, kind: input.kind, text: input.text, citations: input.citations ?? 0,
      level, chapter: chapters.length - 1,
    });
  });
  // A chapter runs to the next heading of the same or a higher level.
  chapters.forEach((chapter, i) => {
    const next = chapters.slice(i + 1).find((other) => other.level <= chapter.level);
    chapter.end = next ? next.block : blocks.length;
  });
  return { blocks, chapters };
}

const KIND_OF: Readonly<Record<string, ReviewBlock["kind"]>> = {
  heading: "heading", paragraph: "paragraph", quote: "quote", bulletItem: "list",
};

function textOf(node: PmNode): { text: string; citations: number } {
  let text = "";
  let citations = 0;
  node.descendants((child) => {
    if (child.type.name === "citation") { text += CITATION_MARK; citations += 1; return false; }
    if (child.isText) text += child.text ?? "";
    return true;
  });
  return { text, citations };
}

/** The model of the document the editor holds. Blocks the checks do not read (tables, images) are "other" with no text. */
export function readReviewDoc(doc: PmNode): ReviewDoc {
  const headings = numberedHeadings(doc);
  const byPos = new Map(headings.map((heading) => [heading.pos, heading]));
  const inputs: (BlockInput & { pos: number })[] = [];
  doc.forEach((node, pos) => {
    const kind = KIND_OF[node.type.name] ?? "other";
    const { text, citations } = kind === "other" ? { text: "", citations: 0 } : textOf(node);
    const heading = byPos.get(pos);
    const id = heading?.id ?? (typeof node.attrs["nodeId"] === "string" && node.attrs["nodeId"] !== "" ? (node.attrs["nodeId"] as string) : null);
    inputs.push({ id, kind, text, citations, level: heading?.level ?? 0, pos });
  });
  const model = reviewDocOf(inputs);
  // Positions of the document, not indices; the numbers come from the editor's own projection.
  const blocks = model.blocks.map((block, i) => ({ ...block, pos: inputs[i]!.pos }));
  const chapters = model.chapters.map((chapter, i) => ({
    ...chapter, pos: inputs[chapter.block]!.pos, number: headings[i]?.number ?? chapter.number,
  }));
  return { blocks, chapters };
}
