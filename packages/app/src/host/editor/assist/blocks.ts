// WEB-2128: the work as the assist rules read it. A thin view of the canonical
// document: chapters by heading level, their words, citations and text. Nothing
// here numbers a heading or writes to the work; the rules are heuristics that
// only read the student's own text (INVENTAR-editor §2.4 advice.js).
import type { VersionedDocument } from "../../../../../editor-core/src/document/document/index.ts";

export type AssistBlock = {
  readonly id: string;
  readonly kind: "heading" | "text";
  readonly level: number;
  readonly text: string;
  readonly cites: number;
};

export type AssistChapter = {
  readonly id: string;
  readonly level: number;
  readonly number: string;
  readonly title: string;
  readonly text: string;
  readonly words: number;
  readonly cites: number;
  readonly parentId: string | null;
  readonly empty: boolean;
};

export const CHAPTER_LEVEL = 1;

export function assistBlocksOf(doc: VersionedDocument): AssistBlock[] {
  return doc.nodes.map((node) => {
    const children = node.children as readonly { type: string; text?: string }[];
    const text = children.map((c) => (c.type === "text" ? (c.text ?? "") : " ")).join("");
    const cites = children.filter((c) => c.type === "citation").length;
    const level = node.type === "heading" ? Number((node as { level: number }).level) : 0;
    return { id: node.id, kind: node.type === "heading" ? "heading" : "text", level, text, cites };
  });
}

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((w) => w.length > 0).length;
}

/** Lower case without diacritics: "Zaključak" and "zakljucak" are one word. */
export function norm(text: string): string {
  return text.toLowerCase().replace(/đ/gu, "d").normalize("NFD").replace(/\p{M}+/gu, "");
}

/**
 * Chapters are the headings of `chapterLevel` and the level below it; a
 * heading owns the text up to the next heading of the same or a higher level.
 * The number is the position among its siblings ("2", "2.1").
 */
export function chaptersOf(blocks: readonly AssistBlock[], chapterLevel: number = CHAPTER_LEVEL): AssistChapter[] {
  const chapters: AssistChapter[] = [];
  let major = 0;
  let sub = 0;
  let majorId: string | null = null;
  let current: { id: string; level: number; title: string; number: string; parentId: string | null; texts: string[]; cites: number } | null = null;
  const close = () => {
    if (!current) return;
    const text = current.texts.join("\n");
    const words = countWords(text);
    chapters.push({ id: current.id, level: current.level, number: current.number, title: current.title, text, words, cites: current.cites, parentId: current.parentId, empty: words === 0 });
    current = null;
  };
  for (const block of blocks) {
    if (block.kind === "heading" && (block.level === chapterLevel || block.level === chapterLevel + 1)) {
      close();
      if (block.level === chapterLevel) {
        major += 1; sub = 0; majorId = block.id;
        current = { id: block.id, level: block.level, title: block.text.trim(), number: String(major), parentId: null, texts: [], cites: 0 };
      } else {
        sub += 1;
        current = { id: block.id, level: block.level, title: block.text.trim(), number: `${major}.${sub}`, parentId: majorId, texts: [], cites: 0 };
      }
      continue;
    }
    if (block.kind === "heading" && block.level > chapterLevel + 1) {
      current?.texts.push(block.text);
      continue;
    }
    if (current) { current.texts.push(block.text); current.cites += block.cites; }
  }
  close();
  return chapters;
}

/** Text of a chapter with the text of its subchapters: what "the chapter" says as a whole. */
export function ownAndSub(chapters: readonly AssistChapter[], id: string): { text: string; words: number; cites: number } {
  const own = chapters.find((c) => c.id === id);
  if (!own) return { text: "", words: 0, cites: 0 };
  const all = [own, ...chapters.filter((c) => c.parentId === id)];
  return { text: all.map((c) => c.text).join("\n"), words: all.reduce((n, c) => n + c.words, 0), cites: all.reduce((n, c) => n + c.cites, 0) };
}
