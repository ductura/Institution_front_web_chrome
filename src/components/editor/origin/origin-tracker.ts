/**
 * PM1-R01 (F4-PM1-R01): where each piece of the sheet's text came from, kept in
 * the editor while the student writes, so that every revision the server
 * confirms can be followed by its ranges of origin (`work.origin-segments.post`).
 *
 * - The kind of an insert is decided when it happens, from the source the
 *   evidence session already gives the change (`recordWithSource`), and never
 *   later. Anything without a named source (undo, redo, a toolbar click, a
 *   find and replace, an autocorrect, the Literatura form) is left unmarked:
 *   no kind is guessed, so nothing is counted as typed that was not.
 * - Ranges are ProseMirror positions mapped through every transaction; a newer
 *   insert takes its place from an older range, so ranges never overlap.
 * - Nothing here keeps text, a key or a time: a range is two positions and a
 *   kind. The text is read only to count code points when the ranges of a
 *   confirmed revision are laid over its blocks (`segmentsOf`).
 */

import type { Node as PmNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import { BLOCK_ID, MAX_ORIGIN_SEGMENTS, type OriginSegment } from "@/client/origin-segments";
import type { OriginKind } from "@/client/input-rhythm";

/**
 * The kind of a change from its evidence source (closed list of SRV-0910 a).
 * `import` and `ai-transfer` are the v4 sources (`EVIDENCE_SOURCES_V4`), which
 * no capture writes yet; they are named here so the kinds follow when it does.
 */
export function originOfSource(source: string | null): OriginKind | null {
  switch (source) {
    case "editor":
    case "keyless-input":
    case "composition":
      return "typed";
    case "paste":
    case "drop":
      return "pasted_unknown";
    case "import":
      return "imported_file";
    case "ai-transfer":
      return "assistant_inserted";
    default:
      return null;
  }
}

type Range = { readonly from: number; readonly to: number; readonly kind: OriginKind };

/** A range of a stored revision in code points, to be placed on the loaded sheet. */
type Seed = { readonly blocks: ReadonlyMap<string, string>; readonly segments: readonly OriginSegment[] };

/** The text a canonical block contributes: its text children joined, as the server's `textBlocksOf`. */
export function canonicalTextBlocks(document: unknown): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const walk = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      if (!isRecord(node) || !Array.isArray(node.children)) continue;
      const children = node.children as readonly unknown[];
      if (children.some((child) => isRecord(child) && Array.isArray(child.children))) { walk(children); continue; }
      if (typeof node.id !== "string") continue;
      out.set(node.id, children.map((child) => (isRecord(child) && child.type === "text" && typeof child.text === "string" ? child.text : "")).join(""));
    }
  };
  if (isRecord(document) && Array.isArray(document.nodes)) walk(document.nodes as readonly unknown[]);
  return out;
}

const points = (text: string): number => Array.from(text).length;

type LiveBlock = { readonly id: string; readonly pos: number; readonly node: PmNode; readonly text: string };

/** Every text block of the sheet with its id, its position and its text (text nodes only). */
function liveBlocks(doc: PmNode): LiveBlock[] {
  const out: LiveBlock[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const id = node.attrs.nodeId;
    if (typeof id === "string") {
      let text = "";
      node.forEach((child) => { if (child.isText) text += child.text ?? ""; });
      out.push({ id, pos, node, text });
    }
    return false;
  });
  return out;
}

/** The code point offset in `block` of the document position `at` (clamped to the block's content). */
function offsetIn(block: LiveBlock, at: number): number {
  const start = block.pos + 1;
  let count = 0;
  block.node.forEach((child, offset) => {
    const from = start + offset;
    if (!child.isText || from >= at) return;
    const text = child.text ?? "";
    count += points(text.slice(0, Math.min(text.length, at - from)));
  });
  return count;
}

/** The document position of the code point offset `at` in `block`, or null past its text. */
function positionIn(block: LiveBlock, at: number): number | null {
  const start = block.pos + 1;
  let left = at;
  let found: number | null = null;
  block.node.forEach((child, offset) => {
    if (found !== null || !child.isText) return;
    const chars = Array.from(child.text ?? "");
    if (left <= chars.length) {
      found = start + offset + chars.slice(0, left).join("").length;
      return;
    }
    left -= chars.length;
  });
  return found ?? (left === 0 ? start : null);
}

/**
 * The ranges of `ranges` laid over the text blocks of `doc`, in code points per
 * block, adjacent ranges of one kind joined. Only a block whose text is the
 * same in `confirmed` (the revision the server confirmed) is described: a block
 * typed into after that revision is left out until the next one, never sent
 * with offsets that would fit another text.
 */
export function segmentsOf(doc: PmNode, ranges: readonly Range[], confirmed: ReadonlyMap<string, string>): OriginSegment[] {
  const out: OriginSegment[] = [];
  for (const block of liveBlocks(doc)) {
    if (!BLOCK_ID.test(block.id) || confirmed.get(block.id) !== block.text || block.text.length === 0) continue;
    const from = block.pos + 1;
    const to = block.pos + block.node.nodeSize - 1;
    const pieces: OriginSegment[] = [];
    for (const range of ranges) {
      if (range.to <= from || range.from >= to) continue;
      const start = offsetIn(block, Math.max(range.from, from));
      const end = offsetIn(block, Math.min(range.to, to));
      if (end <= start) continue;
      const last = pieces[pieces.length - 1];
      if (last && last.kind === range.kind && last.end === start) pieces[pieces.length - 1] = { ...last, end };
      else pieces.push({ blockId: block.id, start, end, kind: range.kind });
    }
    out.push(...pieces);
  }
  return out.slice(0, MAX_ORIGIN_SEGMENTS);
}

/** The origin ranges of one open sheet. */
export class OriginTracker {
  private ranges: Range[] = [];
  private doc: PmNode | null = null;
  private seed: Seed | null = null;

  /**
   * The ranges the server keeps for the revision the sheet was loaded at,
   * with the text of that revision's blocks; placed on the first change, and
   * only on a block whose text there is still that text.
   */
  seedWith(blocks: ReadonlyMap<string, string>, segments: readonly OriginSegment[]): void {
    if (this.doc === null) this.seed = { blocks, segments };
  }

  /** One editor change: every transaction of it, in order, with the kind of its source. */
  apply(transactions: readonly Transaction[], kind: OriginKind | null): void {
    const changing = transactions.filter((tr) => tr.docChanged);
    const first = changing[0];
    if (first === undefined) return;
    if (this.doc === null) {
      this.placeSeed(first.before);
    } else if (!first.before.eq(this.doc)) {
      // A change went by without passing here: the positions no longer fit.
      this.ranges = [];
    }
    for (const tr of changing) {
      const inserted: { from: number; to: number }[] = [];
      tr.mapping.maps.forEach((map, index) => {
        const rest = tr.mapping.slice(index + 1);
        map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
          if (newEnd <= newStart) return;
          const from = rest.map(newStart, 1);
          const to = rest.map(newEnd, -1);
          if (to > from) inserted.push({ from, to });
        });
      });
      this.ranges = this.ranges
        .map((range) => ({ ...range, from: tr.mapping.map(range.from, 1), to: tr.mapping.map(range.to, -1) }))
        .filter((range) => range.to > range.from);
      for (const { from, to } of inserted) this.paint(from, to, kind);
    }
    this.doc = changing[changing.length - 1]!.doc;
  }

  /** The ranges of the last change's document, laid over the blocks of the confirmed revision. */
  segmentsFor(confirmed: ReadonlyMap<string, string>): OriginSegment[] {
    return this.doc === null ? [] : segmentsOf(this.doc, this.ranges, confirmed);
  }

  private paint(from: number, to: number, kind: OriginKind | null): void {
    const next: Range[] = [];
    for (const range of this.ranges) {
      if (range.to <= from || range.from >= to) { next.push(range); continue; }
      if (range.from < from) next.push({ ...range, to: from });
      if (range.to > to) next.push({ ...range, from: to });
    }
    if (kind !== null) next.push({ from, to, kind });
    this.ranges = next.sort((a, b) => a.from - b.from);
  }

  private placeSeed(loaded: PmNode): void {
    const seed = this.seed;
    this.seed = null;
    if (seed === null) return;
    const blocks = new Map(liveBlocks(loaded).map((block) => [block.id, block]));
    for (const segment of seed.segments) {
      const block = blocks.get(segment.blockId);
      if (!block || seed.blocks.get(segment.blockId) !== block.text) continue;
      const from = positionIn(block, segment.start);
      const to = positionIn(block, segment.end);
      if (from !== null && to !== null && to > from) this.paint(from, to, segment.kind);
    }
  }
}
