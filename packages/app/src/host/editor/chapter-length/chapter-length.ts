import {
  documentWordCount,
  type VersionedDocument,
} from "../../../../../editor-core/src/document/document/index.ts";
import { tiptapToCanonical } from "../../../../../editor-core/src/editor/interop.ts";
import { deriveChapters } from "../../../../../editor-core/src/outline/index.ts";
import type { WordRange } from "@ductura/ui";

export function chapterWordCounts(document: VersionedDocument): ReadonlyMap<string, number> {
  const blocks = new Map(document.nodes.map((block) => [block.id, block]));
  const counts = new Map<string, number>();
  for (const chapter of deriveChapters(document).chapters) {
    const nodes = chapter.ownBlockIds.flatMap((id) => {
      const block = blocks.get(id);
      return block ? [block] : [];
    });
    counts.set(chapter.blockId, documentWordCount({ ...document, nodes } as VersionedDocument));
  }
  return counts;
}

type EditorDocument = { toJSON(): unknown };
const editorCounts = new WeakMap<EditorDocument, ReadonlyMap<string, number>>();

/** Selection changes reuse the counts for the same immutable editor document. */
export function editorChapterWordCounts(document: EditorDocument): ReadonlyMap<string, number> {
  const cached = editorCounts.get(document);
  if (cached) return cached;
  const canonical = tiptapToCanonical(document.toJSON());
  const counts = canonical.ok ? chapterWordCounts(canonical.doc) : new Map<string, number>();
  editorCounts.set(document, counts);
  return counts;
}

export type ChapterTargets = ReadonlyMap<string, WordRange>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isLimit = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** The optional assignment-rules extension is keyed by stable heading block id. */
export function chapterTargetsOf(rules: unknown): ChapterTargets {
  const targets = new Map<string, WordRange>();
  if (!isRecord(rules) || !isRecord(rules.chapterWordRanges)) return targets;
  for (const [id, range] of Object.entries(rules.chapterWordRanges)) {
    if (!id || !isRecord(range)) continue;
    const { min, max } = range;
    if ((min !== null && !isLimit(min)) || (max !== null && !isLimit(max))) continue;
    if (min === null ? max === null : max !== null && min > max) continue;
    targets.set(id, { min, max });
  }
  return targets;
}
