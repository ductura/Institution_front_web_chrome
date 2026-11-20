import type { Node as PmNode, ResolvedPos } from "@tiptap/pm/model";

import type { EditStepBlockV4, EditStepV4 } from "../../document/edit-step";
import { canonicalizeJcs } from "../jcs";
import { applyPmStep, refuse, removedRangeCanonical, type RemovedRangeClaim } from "./edit-steps-v1-rules";

/**
 * Rules of the `ductus-edit-steps-v4` replayer (docs/contracts/document-schema-v4.md
 * §9), shared by the server and the browser like `edit-steps-v1-rules.ts`,
 * of which this is the generalisation to blocks at any depth: a paragraph in
 * a box, a box, an atom block. The obligations of v1 hold unchanged:
 * positions inside the document and never inside a surrogate pair, a record
 * of what a range removes (hash, or `structure`), the identity of every
 * existing block, and refusal of a step that changes nothing. New in v4:
 *   - one position is an atom (inline or block): a position inside it is
 *     refused by ProseMirror itself, and a step that would cut it fails;
 *   - an atom block that replaces an atom block keeps its `nodeId` and its
 *     type (point 3); the hash is over the removed block;
 *   - `replaceAround` is a change of one block's markup (id kept), a wrap in
 *     a new box (no id) or the lift of the blocks out of a box.
 * No Node module may be imported here: the browser runs this file.
 */

type ContentStep = Exclude<EditStepV4, { stepType: "sourceSet" | "sourceRemove" | "coverSet" }>;

const isHigh = (unit: number) => unit >= 0xd800 && unit <= 0xdbff;
const isLow = (unit: number) => unit >= 0xdc00 && unit <= 0xdfff;

function at(document: PmNode, pos: number): ResolvedPos {
  if (pos > document.content.size) refuse("position_outside_document");
  const resolved = document.resolve(pos);
  const left = resolved.nodeBefore?.text;
  const right = resolved.nodeAfter?.text;
  if (left && right && isHigh(left.charCodeAt(left.length - 1)) && isLow(right.charCodeAt(0))) {
    refuse("position_splits_surrogate_pair");
  }
  return resolved;
}

/** Whether the range holds text, an atom or a whole block at any depth. */
export function removesContentV4(document: PmNode, from: number, to: number): boolean {
  if (document.textBetween(from, to, undefined, "￼").length > 0) return true;
  let whole = false;
  document.nodesBetween(from, to, (node, pos) => {
    whole ||= !node.isText && pos >= from && pos + node.nodeSize <= to;
    return !whole;
  });
  return whole;
}

type Written = { type: string; attrs?: Record<string, unknown>; nodeId?: unknown };

const writtenId = (block: Written): unknown => (block.attrs ? block.attrs.nodeId : block.nodeId);

/** The markup a block of a slice must repeat to continue `block`: type and every attribute but the id. */
function continues(written: Written, block: PmNode): boolean {
  if (written.type !== block.type.name || !written.attrs) return false;
  return Object.entries(block.attrs).every(([key, value]) => key === "nodeId" || written.attrs![key] === value);
}

const sameId = (written: Written, block: PmNode) => writtenId(written) === block.attrs.nodeId;

function* checkReplace(
  document: PmNode,
  step: Extract<ContentStep, { stepType: "replace" }>,
): Generator<RemovedRangeClaim, void, void> {
  const $from = at(document, step.from);
  const $to = at(document, step.to);
  if (step.to > step.from) {
    const content = removesContentV4(document, step.from, step.to);
    if (content !== "removedSha256" in step || content === "structure" in step) refuse("removed_range_record");
    if (content) {
      yield { canonical: removedRangeCanonical(document, step.from, step.to), recorded: step.removedSha256 };
    }
  }
  const slice = step.slice;
  const first = slice?.content[0] as Written | undefined;
  if (!slice || !first || document.type.schema.nodes[first.type]?.isInline) return;
  const blocks = slice.content as EditStepBlockV4[] as Written[];
  const atomAt = $from.nodeAfter;
  // An atom block put over an atom block continues it (point 3).
  if (blocks.length === 1 && !first.attrs && step.to - step.from === 1 && atomAt?.isAtom) {
    if (first.type !== atomAt.type.name || first.nodeId !== atomAt.attrs.nodeId) refuse("replace_atom_identity");
    return;
  }
  if ("openStart" in slice && (!$from.parent.isTextblock || !continues(first, $from.parent) || !sameId(first, $from.parent))) {
    refuse("open_start_block");
  }
  if ("openEnd" in slice) {
    const last = blocks[blocks.length - 1]!;
    const sameParent = $from.parent.isTextblock && $to.parent.isTextblock && $from.before() === $to.before();
    const ok = sameParent
      ? writtenId(last) === null
      : $to.parent.isTextblock && continues(last, $to.parent) && sameId(last, $to.parent);
    if (!ok) refuse("open_end_block");
  }
}

function checkReplaceAround(
  document: PmNode,
  step: Extract<ContentStep, { stepType: "replaceAround" }>,
): void {
  const $from = at(document, step.from);
  at(document, step.to);
  const wrapper = step.slice?.content[0] as Written | undefined;
  const block = document.nodeAt(step.from);
  const lift = step.insert === 0;
  const wraps = step.gapFrom === step.from;
  if (lift) {
    // The lift: the range is one box, its inside is the gap.
    if (!block || block.type.name !== "box" || step.from + block.nodeSize !== step.to) refuse("replace_around_range");
    return;
  }
  if (wraps) {
    // The wrap: a new box over whole blocks that share one parent.
    if (!wrapper || writtenId(wrapper) !== null || $from.parent !== at(document, step.to).parent) refuse("replace_around_identity");
    return;
  }
  // The change of one block's markup: the block is the range, its id stays.
  if (!block || step.from + block.nodeSize !== step.to) refuse("replace_around_range");
  if (!wrapper || writtenId(wrapper) !== block.attrs.nodeId) refuse("replace_around_identity");
  const unchanged =
    wrapper.type === block.type.name &&
    Object.entries(block.attrs).every(([key, value]) => key === "nodeId" || wrapper.attrs?.[key] === value);
  if (unchanged) refuse("replace_around_unchanged");
}

export function* checkContentStepV4(document: PmNode, step: ContentStep): Generator<RemovedRangeClaim, void, void> {
  switch (step.stepType) {
    case "replace":
      return yield* checkReplace(document, step);
    case "replaceAround":
      return checkReplaceAround(document, step);
    case "addMark":
    case "removeMark":
      at(document, step.from);
      at(document, step.to);
      return;
    case "attr": {
      const $pos = at(document, step.pos);
      const block = document.nodeAt(step.pos);
      const level = $pos.parent.type.name;
      if (!block || block.isInline || (level !== "doc" && level !== "box") || block.attrs.nodeId !== null) {
        refuse("attr_identity");
      }
    }
  }
}

/** The first block that has no id, or repeats one: identity of every block, at any depth (obligation 4). */
export function checkBlockIdentity(document: PmNode): void {
  const seen = new Set<string>();
  document.descendants((node) => {
    if (node.isInline || node.isText) return false;
    if (node.type.name === "doc") return true;
    const id: unknown = node.attrs.nodeId;
    if (typeof id !== "string" || seen.has(id.toLowerCase())) refuse("block_identity");
    seen.add(id.toLowerCase());
    return true;
  });
}

/** Applies one step of `ductus-edit-steps-v4` to a ProseMirror document, JSON as the schema reads it. */
export function applyPmStepV4(document: PmNode, pmJson: Record<string, unknown>): PmNode {
  const next = applyPmStep(document, pmJson);
  next.check();
  return next;
}

/** The hash of the cover as the format records it (JCS of the cover object). */
export function coverCanonical(cover: unknown): string {
  return canonicalizeJcs(cover as never);
}
