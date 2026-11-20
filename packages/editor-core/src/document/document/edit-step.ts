/**
 * Serialised form of one editing step, shared by the client and the server.
 *
 * Pure: no DOM, no editor library, no clock, no I/O. The editor's capture and
 * the server's replayer both read steps through `parseEditStep`, so neither
 * can accept a shape the other does not know.
 *
 * The shape is the JSON that ProseMirror's own steps serialise to, narrowed
 * to what the F1 schema can produce (paragraph, heading 1-3, bullet item,
 * quote, text, bold, italic), plus `removedSha256` on a step that removes content. Everything
 * else is refused, never guessed:
 *   - every object has a closed set of keys, so an unknown field, a
 *     `__proto__` or `constructor` key and any time field (owner decision 6:
 *     steps carry no time) have nowhere to sit;
 *   - an accepted step is written the way ProseMirror would write it back:
 *     optional parts are absent rather than empty, `false` or `0`, text
 *     nodes that ProseMirror would join are already joined, and a slice is
 *     never empty;
 *   - where two forms of the same change can be told apart without the
 *     document, one of them is refused: a block made by a slice carries no id
 *     (owner decision 3: the id comes from an `attr` step), `structure` on an
 *     insertion stands only on a split, one block open on both sides is written
 *     as text, and a change of a block's type is written as `replaceAround`.
 *     The same goes for a step that no document can make right (see
 *     `replaceShape`): a range the slice cannot fit, `structure` over text or
 *     a whole block, and a slice that puts back the boundary its range removes.
 *     This does not make every change have one form. The rest needs the
 *     document and is the replayer's job (listed in the description of #213):
 *     the block on an open side of a slice, the range of a mark step, a range
 *     that removes and re-inserts the same block boundary;
 *   - positions are non-negative safe integers; whether they lie inside a
 *     document is the replayer's check, because only it holds the document;
 *   - text is well-formed Unicode without NUL and is never normalised: the
 *     hash covers exactly what was recorded.
 *
 * The result is a fresh copy built from known fields only, with keys in
 * sorted order, so `JSON.stringify` of it is already its RFC 8785 form.
 */

import { isPlainObject } from "../json";
import { isAllowedText, isAllowedTrimmedText } from "./forbidden";
import {
  BOX_KINDS,
  CODE_LANGUAGES,
  MARK_V4_ORDER,
  MAX_CODE_CAPTION_CODE_POINTS,
  MAX_FORMULA_TEX_CODE_POINTS,
  MAX_INLINE_FORMULA_TEX_CODE_POINTS,
  type CoverV4,
  type MarkV4Type,
  isHeadingLevel,
  isMark,
  isPlainBlockType,
  isCrossReferenceTarget,
  isRequestId,
  isSourceId,
  MARK_ORDER,
  MAX_CITATION_LOCATOR_CODE_POINTS,
  MAX_CITATION_VIA_CODE_POINTS,
  MAX_FOOTNOTE_TEXT_CODE_POINTS,
  type DocumentSource,
  type HeadingLevel,
  type Mark,
  type NodeId,
  type PlainBlockType,
  type RequestId,
  type SourceId,
} from "./schema";
import type { ValidationError } from "./validate";
import { validateSources } from "./validate-sources";
import { ATTRIBUTE_RULES, OBJECT_MARKS, STRING_MARKS } from "./validate-marks-v4";
import { validateCover } from "./validate-image-cover-v4";
import { validateImage } from "./validate-image-cover-v4";
import { validateTable } from "./validate-table-v4";

/** Value of `captureContext.transactionFormat` for this step format. */
export const EDIT_STEP_FORMAT_V1 = "ductus-edit-steps-v1" as const;

/**
 * Steps on a document of schema version 2 (docs/contracts/document-schema-v2.md
 * §5): the v1 steps, whose slices may also hold citations, plus `sourceSet`
 * and `sourceRemove`. Revision zero of a work decides which format it uses
 * (§5.4); `parseEditSteps` only reads the one it is told.
 */
export const EDIT_STEP_FORMAT_V2 = "ductus-edit-steps-v2" as const;

/**
 * Steps on a document of schema version 3 (docs/contracts/document-schema-v3.md
 * §5): the v2 steps, whose slices may also hold a footnote, a cross reference
 * and a citation with `via` and `rq`. A change of an atom's attributes is a
 * `replace` of its one position; `attr` still sets only a block's `nodeId`.
 */
export const EDIT_STEP_FORMAT_V3 = "ductus-edit-steps-v3" as const;

/**
 * Steps on a document of schema version 4 (docs/contracts/document-schema-v4.md
 * §9): the v3 steps, whose slices may also hold the blocks, atoms and marks of
 * v4, plus `coverSet`. A block with fields of its own (paragraph with
 * `variantGroup`, code block, box) is written as ProseMirror writes it, every
 * attribute present and absent ones `null`. An atom block (table, image,
 * formula, page break) and the inline formula are written in document form,
 * with `nodeId` for the block's id.
 */
export const EDIT_STEP_FORMAT_V4 = "ductus-edit-steps-v4" as const;

export const EDIT_STEP_TYPES = [
  "replace",
  "replaceAround",
  "addMark",
  "removeMark",
  "attr",
] as const;

export type EditStepType = (typeof EDIT_STEP_TYPES)[number];

/**
 * The limit of a whole evidence segment (D-96, 2 MiB), applied to the UTF-8
 * bytes of the canonical (RFC 8785) form: of one step in `parseEditStep`, and
 * of the JSON array of all steps of one event in `parseEditSteps`. Exactly
 * this many bytes are accepted, one more is `too_large`.
 */
export const MAX_EDIT_STEP_BYTES = 2_097_152;

export type EditStepMark = { type: Mark };
export type EditStepText = { marks?: EditStepMark[]; text: string; type: "text" };
/**
 * A citation in a slice of `EDIT_STEP_FORMAT_V2`, in its document form
 * (contract §3.1, §5.1): no marks, one position, never in a heading.
 */
export type EditStepCitation = { locator?: string; sourceId: SourceId; type: "citation" };
export type EditStepInlineV2 = EditStepText | EditStepCitation;
/** The atoms of `EDIT_STEP_FORMAT_V3` in their document form (contract v3 §3, §5). */
export type EditStepCitationV3 = EditStepCitation & { rq?: RequestId; via?: string };
export type EditStepFootnote = { text: string; type: "footnote" };
export type EditStepCrossReference = { targetId: NodeId; type: "crossReference" };
export type EditStepInlineV3 =
  EditStepText | EditStepCitationV3 | EditStepFootnote | EditStepCrossReference;

/**
 * `nodeId` is `null` on every block a `replace` creates. It is an id only on
 * a block that continues an existing one: on an open side of a slice, and in
 * `replaceAround`. A heading holds text only, in both formats.
 */
export type EditStepBlockOf<I extends EditStepInlineV3> =
  | { attrs: { nodeId: NodeId | null }; content?: I[]; type: PlainBlockType }
  | {
      attrs: { level: HeadingLevel; nodeId: NodeId | null };
      content?: EditStepText[];
      type: "heading";
    };
export type EditStepBlock = EditStepBlockOf<EditStepText>;
export type EditStepSliceOf<I extends EditStepInlineV3> = {
  content: EditStepBlockOf<I>[] | I[];
  openEnd?: 1;
  openStart?: 1;
};
export type EditStepSlice = EditStepSliceOf<EditStepText>;
export type EditStepSliceV2 = EditStepSliceOf<EditStepInlineV2>;
export type EditStepSliceV3 = EditStepSliceOf<EditStepInlineV3>;

type ContentStep<I extends EditStepInlineV3> =
  | {
      from: number;
      /** Present exactly when the step removes content: `to > from`, not `structure`. */
      removedSha256?: string;
      slice?: EditStepSliceOf<I>;
      stepType: "replace";
      structure?: true;
      to: number;
    }
  | {
      from: number;
      gapFrom: number;
      gapTo: number;
      insert: 1;
      slice: EditStepSliceOf<I>;
      stepType: "replaceAround";
      structure: true;
      to: number;
    }
  | { from: number; mark: EditStepMark; stepType: "addMark" | "removeMark"; to: number }
  | { attr: "nodeId"; pos: number; stepType: "attr"; value: NodeId };

export type EditStepV1 = ContentStep<EditStepText>;

/**
 * Adds a source at the end of `sources`, or replaces the one with the same id
 * in place (contract §5.3). `removedSha256` is the SHA-256 of the canonical
 * form of the record it replaces: absent for a new id, required for an
 * existing one. Which of the two holds only the replayer can tell.
 */
export type EditStepSourceSet = {
  removedSha256?: string;
  source: DocumentSource;
  stepType: "sourceSet";
};
/** Removes a source; citations that point at it stay (contract §5.3). */
export type EditStepSourceRemove = {
  removedSha256: string;
  sourceId: SourceId;
  stepType: "sourceRemove";
};

export type EditStepV2 = ContentStep<EditStepInlineV2> | EditStepSourceSet | EditStepSourceRemove;
export type EditStepV3 = ContentStep<EditStepInlineV3> | EditStepSourceSet | EditStepSourceRemove;

/** A mark of a step in v4: a mark with attributes is `{type, attrs}` (contract §9). */
export type EditStepMarkV4 = { attrs?: Record<string, string | null>; type: MarkV4Type };
export type EditStepTextV4 = { marks?: EditStepMarkV4[]; text: string; type: "text" };
export type EditStepInlineFormula = { tex: string; type: "inlineFormula" };
export type EditStepInlineV4 =
  | EditStepTextV4
  | EditStepCitationV3
  | EditStepFootnote
  | EditStepCrossReference
  | EditStepInlineFormula;
/** Atom blocks in document form: `nodeId` instead of `id`, no `children`. */
export type EditStepAtomBlock = {
  nodeId: NodeId | null;
  type: "table" | "image" | "formula" | "pageBreak";
} & Record<string, unknown>;
export type EditStepBlockV4 =
  | { attrs: Record<string, unknown>; content?: (EditStepInlineV4 | EditStepBlockV4)[]; type: string }
  | EditStepAtomBlock;
export type EditStepSliceV4 = {
  content: EditStepBlockV4[] | EditStepInlineV4[];
  openEnd?: 1;
  openStart?: 1;
};
type ContentStepV4 =
  | {
      from: number;
      removedSha256?: string;
      slice?: EditStepSliceV4;
      stepType: "replace";
      structure?: true;
      to: number;
    }
  | {
      from: number;
      gapFrom: number;
      gapTo: number;
      insert: 0 | 1;
      slice?: EditStepSliceV4;
      stepType: "replaceAround";
      structure: true;
      to: number;
    }
  | { from: number; mark: EditStepMarkV4; stepType: "addMark" | "removeMark"; to: number }
  | { attr: "nodeId"; pos: number; stepType: "attr"; value: NodeId };
/** Sets the whole cover, or removes it (no `cover`); contract v4 §9, point 7. */
export type EditStepCoverSet = { cover?: CoverV4; removedSha256?: string; stepType: "coverSet" };
export type EditStepV4 = ContentStepV4 | EditStepSourceSet | EditStepSourceRemove | EditStepCoverSet;

export const EDIT_STEP_REJECTIONS = [
  "unsupported_format",
  "steps_not_array",
  "steps_empty",
  "not_object",
  "forbidden_key",
  "unknown_field",
  "missing_field",
  "unknown_step_type",
  "invalid_position",
  "invalid_value",
  "invalid_slice",
  "invalid_node",
  "invalid_mark",
  "invalid_text",
  "invalid_node_id",
  "new_block_has_id",
  "invalid_removed_hash",
  "not_canonical",
  "too_large",
  "unreadable",
] as const;

export type EditStepRejection = (typeof EDIT_STEP_REJECTIONS)[number];

export type EditStepResult =
  { ok: true; step: EditStepV1 } | { ok: false; code: EditStepRejection; path: string };

export type EditStepsResult =
  { ok: true; steps: EditStepV1[] } | { ok: false; code: EditStepRejection; path: string };

export type EditStepsV2Result =
  { ok: true; steps: EditStepV2[] } | { ok: false; code: EditStepRejection; path: string };

export type EditStepsV3Result =
  { ok: true; steps: EditStepV3[] } | { ok: false; code: EditStepRejection; path: string };

export type EditStepsV4Result =
  { ok: true; steps: EditStepV4[] } | { ok: false; code: EditStepRejection; path: string };

class Rejected extends Error {
  // Declared fields, not parameter properties: server.ts runs under Node's
  // type stripping, which has no parameter properties (DAN-811).
  readonly code: EditStepRejection;
  readonly path: string;
  constructor(code: EditStepRejection, path: string) {
    super(code);
    this.code = code;
    this.path = path;
  }
}

function reject(code: EditStepRejection, path: string): never {
  throw new Rejected(code, path);
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SHA256_HEX = /^[0-9a-f]{64}$/;
/**
 * A node id in a step is a random UUID (version 4) in lower case, and nothing
 * else. Versions 1, 6 and 7 carry a timestamp finer than a minute, which a
 * step may not hold (owner decision 6, D-24); upper case would be a second
 * way to write the same id. Narrower than `isNodeId` on purpose.
 */
const STEP_NODE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isStepNodeId(value: unknown): value is NodeId {
  return typeof value === "string" && STEP_NODE_ID.test(value);
}
/** Smaller than the canonical form of any node, mark or step. */
const MIN_OBJECT_BYTES = 16;

/** No array that fits the byte limit is longer; checked before it is copied. */
const MAX_ITEMS = MAX_EDIT_STEP_BYTES / MIN_OBJECT_BYTES;

/**
 * `floor` is a lower bound of the canonical size, kept while reading so that
 * oversized input is refused before it is copied or serialised. `exact` is
 * the real canonical size of what has been accepted so far; it decides.
 */
type Budget = { floor: number; exact: number; version: 1 | 2 | 3 | 4 };

/**
 * Steps are read in the v3 shapes; a budget of an earlier version refuses
 * everything a later one adds.
 */
type Inline = EditStepInlineV3 | EditStepInlineV4;
type Block = EditStepBlockOf<EditStepInlineV3> | EditStepBlockV4;
type Slice = { content: Block[] | Inline[]; openEnd?: 1; openStart?: 1 };

function spend(budget: Budget, bytes: number, path: string): void {
  budget.floor += bytes;
  if (budget.floor > MAX_EDIT_STEP_BYTES) {
    reject("too_large", path);
  }
}

/** UTF-8 length of a well-formed string. */
function utf8Length(value: string): number {
  let bytes = value.length;
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      // A pair: two units, four bytes.
      bytes += 2;
      i += 1;
    } else if (unit >= 0x80) {
      bytes += unit < 0x800 ? 1 : 2;
    }
  }
  return bytes;
}

/**
 * Own values of a plain object whose keys are exactly `required` plus any of
 * `optional`. Inherited members are never read, and every own key counts,
 * enumerable or not.
 */
function fields(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    reject("not_object", path);
  }
  // The engine lists all keys of an object before the first can be looked at
  // (`for…in` does the same), so an object with millions of keys costs time
  // in proportion to them, unlike a long array or text. The size limit cannot
  // stop that here: the route that parses the request must bound the body
  // before `JSON.parse`, which is the slower of the two anyway.
  const own: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) {
      reject("forbidden_key", path);
    }
    if (!required.includes(key) && !optional.includes(key)) {
      reject("unknown_field", `${path}.${key}`);
    }
    own[key] = value[key];
  }
  for (const key of required) {
    if (!(key in own)) {
      reject("missing_field", `${path}.${key}`);
    }
  }
  return own;
}

function position(value: unknown, path: string): number {
  // -0 is refused too: it would be a second way to write position 0.
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    Object.is(value, -0)
  ) {
    reject("invalid_position", path);
  }
  return value;
}

function items(value: unknown, path: string, code: EditStepRejection): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    reject(code, path);
  }
  if (value.length > MAX_ITEMS) {
    reject("too_large", path);
  }
  // Array.from turns holes into `undefined`, which no element parser accepts.
  return Array.from(value);
}

/** Well-formed, NUL-free, non-empty text; returns its UTF-8 length. */
function textBytes(value: unknown, path: string): number {
  if (typeof value !== "string" || value.length === 0) {
    reject("invalid_text", path);
  }
  // Every UTF-16 unit is at least one byte: refuse before scanning.
  if (value.length > MAX_EDIT_STEP_BYTES) {
    reject("too_large", path);
  }
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit === 0) {
      reject("invalid_text", path);
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        reject("invalid_text", path);
      }
      i += 1;
      bytes += 4;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      reject("invalid_text", path);
    } else {
      bytes += unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3;
    }
  }
  return bytes;
}

function mark(value: unknown, path: string): EditStepMark {
  const own = fields(value, path, ["type"]);
  if (!isMark(own.type)) {
    reject("invalid_mark", `${path}.type`);
  }
  return { type: own.type };
}

/** Marks a step may add or remove, and marks that enter only with text (§3.1). */
const PROVENANCE_MARKS = new Set(["paste", "imported"]);

/**
 * Contract v4 §3 and §9: a mark without attributes is `{type}`, one with
 * attributes `{type, attrs}` with every attribute named, an absent optional
 * one `null` (as ProseMirror writes it). Values follow the document's rules.
 */
function markV4(value: unknown, path: string): EditStepMarkV4 {
  const own = fields(value, path, ["type"], ["attrs"]);
  const type = own.type;
  if (typeof type !== "string" || !(STRING_MARKS.has(type) || OBJECT_MARKS.has(type))) {
    return reject("invalid_mark", `${path}.type`);
  }
  const rule = OBJECT_MARKS.get(type);
  if (!rule) {
    if ("attrs" in own) reject("unknown_field", `${path}.attrs`);
    return { type: type as MarkV4Type };
  }
  const names = [...rule.required, ...rule.optional];
  const attrs = fields(own.attrs, `${path}.attrs`, names);
  const out: Record<string, string | null> = {};
  for (const name of [...names].sort()) {
    const given = attrs[name];
    if (given === null && rule.optional.includes(name)) {
      out[name] = null;
    } else if (!ATTRIBUTE_RULES[name]!(given)) {
      reject("invalid_value", `${path}.attrs.${name}`);
    } else {
      out[name] = given as string;
    }
  }
  return { attrs: out, type: type as MarkV4Type };
}

/** Non-empty, without repeats, in the canonical order (bold before italic). */
function marks(value: unknown, path: string, version: 1 | 2 | 3 | 4 = 3): EditStepMark[] {
  if (version === 4) return marksV4(value, path) as unknown as EditStepMark[];
  const parsed = items(value, path, "invalid_mark").map((item, i) => mark(item, `${path}[${i}]`));
  for (let i = 1; i < parsed.length; i += 1) {
    if (MARK_ORDER.indexOf(parsed[i - 1]!.type) >= MARK_ORDER.indexOf(parsed[i]!.type)) {
      reject("invalid_mark", `${path}[${i}]`);
    }
  }
  return parsed;
}

/** Non-empty, one per type, in `MARK_V4_ORDER`, and `sup` never with `sub`. */
function marksV4(value: unknown, path: string): EditStepMarkV4[] {
  const parsed = items(value, path, "invalid_mark").map((item, i) => markV4(item, `${path}[${i}]`));
  for (let i = 1; i < parsed.length; i += 1) {
    if (MARK_V4_ORDER.indexOf(parsed[i - 1]!.type) >= MARK_V4_ORDER.indexOf(parsed[i]!.type)) {
      reject("invalid_mark", `${path}[${i}]`);
    }
  }
  if (parsed.some((m) => m.type === "sup") && parsed.some((m) => m.type === "sub")) {
    reject("invalid_mark", path);
  }
  return parsed;
}

function text(value: unknown, path: string, budget: Budget): EditStepText {
  const own = fields(value, path, ["type", "text"], ["marks"]);
  if (own.type !== "text") {
    reject("invalid_node", `${path}.type`);
  }
  spend(budget, MIN_OBJECT_BYTES + textBytes(own.text, `${path}.text`), path);
  const parsed: EditStepText = { text: own.text as string, type: "text" };
  return "marks" in own ? { marks: marks(own.marks, `${path}.marks`, budget.version), ...parsed } : parsed;
}

/** Text of an atom in UTF-16 units, refused unread when it cannot fit `max` code points. */
function atomText(
  value: unknown,
  path: string,
  max: number,
  allowed: (text: unknown, max: number) => boolean,
): string {
  if (typeof value !== "string" || value.length > 2 * max || !allowed(value, max)) {
    return reject("invalid_value", path);
  }
  return value;
}

/**
 * Contract v2 §3.1: `sourceId`, and a locator of 1 to 100 allowed code points;
 * v3 §3.2 adds `via` (tidy text up to 200) and `rq` under a v3 budget only.
 */
function citation(value: unknown, path: string, budget: Budget): EditStepCitationV3 {
  const v3 = budget.version === 3;
  const own = fields(
    value,
    path,
    ["type", "sourceId"],
    v3 ? ["locator", "rq", "via"] : ["locator"],
  );
  if (!isSourceId(own.sourceId)) {
    reject("invalid_value", `${path}.sourceId`);
  }
  const parsed: EditStepCitationV3 = { sourceId: own.sourceId, type: "citation" };
  let bytes = MIN_OBJECT_BYTES;
  if ("locator" in own) {
    parsed.locator = atomText(
      own.locator,
      `${path}.locator`,
      MAX_CITATION_LOCATOR_CODE_POINTS,
      isAllowedText,
    );
    bytes += parsed.locator.length;
  }
  if ("rq" in own) {
    if (!isRequestId(own.rq)) reject("invalid_value", `${path}.rq`);
    parsed.rq = own.rq;
    bytes += own.rq.length;
  }
  if ("via" in own) {
    parsed.via = atomText(
      own.via,
      `${path}.via`,
      MAX_CITATION_VIA_CODE_POINTS,
      isAllowedTrimmedText,
    );
    bytes += parsed.via.length;
  }
  spend(budget, bytes, path);
  return sortKeys(parsed);
}

/** Contract v3 §3.3: tidy plain text of 1 to 2000 code points. */
function footnote(value: unknown, path: string, budget: Budget): EditStepFootnote {
  const own = fields(value, path, ["type", "text"]);
  const content = atomText(
    own.text,
    `${path}.text`,
    MAX_FOOTNOTE_TEXT_CODE_POINTS,
    isAllowedTrimmedText,
  );
  spend(budget, MIN_OBJECT_BYTES + content.length, path);
  return { text: content, type: "footnote" };
}

/** Contract v3 §3.4: a block id as a step writes it. */
function crossReference(value: unknown, path: string, budget: Budget): EditStepCrossReference {
  const own = fields(value, path, ["type", "targetId"]);
  if (!isCrossReferenceTarget(own.targetId)) {
    reject("invalid_value", `${path}.targetId`);
  }
  spend(budget, MIN_OBJECT_BYTES, path);
  return { targetId: own.targetId, type: "crossReference" };
}

/** Inline types besides text, and the first version of the format that has each. */
const ATOM_SINCE: ReadonlyMap<unknown, 2 | 3 | 4> = new Map([
  ["citation", 2],
  ["footnote", 3],
  ["crossReference", 3],
  ["inlineFormula", 4],
]);

/** Contract v4 §4.1: tidy text of 1 to 1000 code points. */
function inlineFormula(value: unknown, path: string, budget: Budget): EditStepInlineFormula {
  const own = fields(value, path, ["type", "tex"]);
  const tex = atomText(own.tex, `${path}.tex`, MAX_INLINE_FORMULA_TEX_CODE_POINTS, isAllowedTrimmedText);
  spend(budget, MIN_OBJECT_BYTES + tex.length, path);
  return { tex, type: "inlineFormula" };
}

function isInline(value: Inline | Block): value is Inline {
  return value.type === "text" || ATOM_SINCE.has(value.type);
}

const ATOM_BLOCK_TYPES = new Set(["table", "image", "formula", "pageBreak"]);

/** Block atoms stand in document form: the id is `nodeId` on the block itself. */
function isAtomBlock(value: Inline | Block): value is EditStepAtomBlock {
  return ATOM_BLOCK_TYPES.has(value.type);
}

/** The id a block of a slice carries, wherever its form keeps it. */
function blockNodeId(value: Block): NodeId | null {
  return isAtomBlock(value) ? value.nodeId : ((value as { attrs: { nodeId: NodeId | null } }).attrs.nodeId);
}

function hasContent(value: Block): boolean {
  return "content" in value;
}

/**
 * One inline node. An atom is read only under a budget of a version that has
 * it; under an earlier one it is a node the format does not have.
 */
function inline(value: unknown, path: string, budget: Budget): Inline {
  const type = isPlainObject(value) && Object.hasOwn(value, "type") ? value.type : undefined;
  const since = ATOM_SINCE.get(type);
  if (since === undefined) {
    return text(value, path, budget);
  }
  if (budget.version < since) {
    return reject("invalid_node", `${path}.type`);
  }
  if (type === "footnote") return footnote(value, path, budget);
  if (type === "inlineFormula") return inlineFormula(value, path, budget);
  if (type === "crossReference") return crossReference(value, path, budget);
  return citation(value, path, budget);
}

/**
 * A run of inline nodes. Neighbouring text with the same marks is refused:
 * ProseMirror joins it when it reads the step, so it would be a second form
 * of it. Text on either side of a citation is not neighbouring (§3.1).
 */
function inlines(raw: readonly unknown[], path: string, budget: Budget): Inline[] {
  const parsed = raw.map((item, i) => inline(item, `${path}[${i}]`, budget));
  for (let i = 1; i < parsed.length; i += 1) {
    const [before, after] = [parsed[i - 1], parsed[i]];
    if (
      before!.type === "text" &&
      after!.type === "text" &&
      JSON.stringify(before!.marks) === JSON.stringify(after!.marks)
    ) {
      reject("not_canonical", `${path}[${i}]`);
    }
  }
  return parsed;
}

function nodeId(value: unknown, path: string): NodeId | null {
  if (value === null || isStepNodeId(value)) {
    return value;
  }
  return reject("invalid_node_id", path);
}

/** Every attribute a ProseMirror node of v4 holds, as the step writes them (§9). */
const BLOCK_ATTRS_V4: Readonly<Record<string, readonly string[]>> = {
  paragraph: ["nodeId", "variantGroup"],
  heading: ["level", "nodeId"],
  bulletItem: ["nodeId"],
  quote: ["nodeId"],
  codeBlock: ["caption", "language", "nodeId"],
  box: ["kind", "nodeId"],
};
const ATOM_FIELDS: Readonly<Record<string, { required: string[]; optional: string[] }>> = {
  table: {
    required: ["rows", "header", "stripes", "landscape"],
    optional: ["headerFill", "cellFills", "merges", "title", "source"],
  },
  image: {
    required: ["widthPercent", "align", "landscape"],
    optional: ["attachmentId", "attachmentSha256", "crop", "title", "source"],
  },
  formula: { required: ["tex"], optional: [] },
  pageBreak: { required: [], optional: [] },
};
/** A valid id for the document validators, which only pass it through. */
const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000" as NodeId;

/** The first fault of a document validator, as a step refusal at the field. */
function checked<T>(run: (errors: ValidationError[]) => T | null, path: string): T {
  const errors: ValidationError[] = [];
  const result = run(errors);
  if (result === null || errors.length > 0) {
    const at = errors[0]?.path ?? path;
    return reject("invalid_value", at.startsWith("$") ? path : at);
  }
  return result;
}

function atomBlock(value: Record<string, unknown>, path: string, budget: Budget): EditStepAtomBlock {
  const type = value.type as string;
  const rule = ATOM_FIELDS[type]!;
  const own = fields(value, path, ["type", "nodeId", ...rule.required], rule.optional);
  const id = nodeId(own.nodeId, `${path}.nodeId`);
  const { nodeId: _nodeId, ...document } = own;
  spend(budget, MIN_OBJECT_BYTES, path);
  const withId = { ...document, id: PLACEHOLDER_ID };
  let parsed: Record<string, unknown>;
  if (type === "table") {
    parsed = checked((errors) => validateTable(withId, path, PLACEHOLDER_ID, errors), path);
  } else if (type === "image") {
    parsed = checked((errors) => validateImage(withId, path, PLACEHOLDER_ID, errors), path);
  } else if (type === "formula") {
    parsed = { tex: atomText(own.tex, `${path}.tex`, MAX_FORMULA_TEX_CODE_POINTS, isAllowedTrimmedText), type };
  } else {
    parsed = { type };
  }
  delete parsed.id;
  return sortKeys({ ...parsed, nodeId: id }) as EditStepAtomBlock;
}

/** Contract v4 §2, §4 and §9: text blocks, the code block, the box and the atom blocks. */
function blockV4(value: unknown, path: string, budget: Budget, inBox = false): Block {
  const type = isPlainObject(value) && Object.hasOwn(value, "type") ? value.type : undefined;
  if (typeof type === "string" && Object.hasOwn(ATOM_FIELDS, type)) {
    if (inBox) reject("invalid_node", `${path}.type`);
    return atomBlock(value as Record<string, unknown>, path, budget);
  }
  if (typeof type !== "string" || !Object.hasOwn(BLOCK_ATTRS_V4, type) || (inBox && type !== "paragraph")) {
    return reject("invalid_node", `${path}.type`);
  }
  const own = fields(value, path, ["type", "attrs"], ["content"]);
  spend(budget, MIN_OBJECT_BYTES, path);
  const attrs = fields(own.attrs, `${path}.attrs`, [...BLOCK_ATTRS_V4[type]!]);
  const out: Record<string, unknown> = { nodeId: nodeId(attrs.nodeId, `${path}.attrs.nodeId`) };
  const attrPath = (name: string) => `${path}.attrs.${name}`;
  if (type === "heading") {
    if (!isHeadingLevel(attrs.level)) reject("invalid_node", attrPath("level"));
    out.level = attrs.level;
  } else if (type === "paragraph") {
    if (attrs.variantGroup !== null && !isSourceId(attrs.variantGroup)) reject("invalid_value", attrPath("variantGroup"));
    out.variantGroup = attrs.variantGroup;
  } else if (type === "codeBlock") {
    if (attrs.language !== null && !(CODE_LANGUAGES as readonly unknown[]).includes(attrs.language)) {
      reject("invalid_value", attrPath("language"));
    }
    if (attrs.caption !== null) {
      out.caption = atomText(attrs.caption, attrPath("caption"), MAX_CODE_CAPTION_CODE_POINTS, isAllowedTrimmedText);
    }
    out.caption ??= null;
    out.language = attrs.language;
  } else if (type === "box") {
    if (!(BOX_KINDS as readonly unknown[]).includes(attrs.kind)) reject("invalid_value", attrPath("kind"));
    out.kind = attrs.kind;
  }
  let content: unknown[] | null = null;
  if ("content" in own) {
    const raw = items(own.content, `${path}.content`, "invalid_node");
    if (type === "box") {
      content = raw.map((item, i) => blockV4(item, `${path}.content[${i}]`, budget, true));
    } else {
      content = inlines(raw, `${path}.content`, budget);
      const bad = (content as Inline[]).findIndex((item) => {
        if (type === "heading" || type === "codeBlock") {
          if (item.type !== "text") return true;
          const marked = (item as EditStepTextV4).marks ?? [];
          return type === "codeBlock" && marked.some((m) => !PROVENANCE_MARKS.has(m.type));
        }
        return false;
      });
      if (bad >= 0) reject("invalid_node", `${path}.content[${bad}]`);
    }
  }
  return sortKeys({ attrs: out, ...(content ? { content } : {}), type }) as Block;
}

function block(value: unknown, path: string, budget: Budget): Block {
  if (budget.version === 4) return blockV4(value, path, budget);
  const own = fields(value, path, ["type", "attrs"], ["content"]);
  const type = own.type;
  if (type !== "heading" && !isPlainBlockType(type)) {
    return reject("invalid_node", `${path}.type`);
  }
  spend(budget, MIN_OBJECT_BYTES, path);
  const content =
    "content" in own
      ? inlines(items(own.content, `${path}.content`, "invalid_node"), `${path}.content`, budget)
      : null;
  if (type !== "heading") {
    const attrs = fields(own.attrs, `${path}.attrs`, ["nodeId"]);
    const node = { attrs: { nodeId: nodeId(attrs.nodeId, `${path}.attrs.nodeId`) } };
    return content ? { ...node, content, type } : { ...node, type };
  }
  const attrs = fields(own.attrs, `${path}.attrs`, ["level", "nodeId"]);
  if (!isHeadingLevel(attrs.level)) {
    reject("invalid_node", `${path}.attrs.level`);
  }
  // Contract §3.1: a heading takes no citation.
  const cited = content?.findIndex((item) => item.type !== "text") ?? -1;
  if (cited >= 0) {
    reject("invalid_node", `${path}.content[${cited}].type`);
  }
  const node = {
    attrs: { level: attrs.level, nodeId: nodeId(attrs.nodeId, `${path}.attrs.nodeId`) },
  };
  const headingText = content as EditStepText[] | null;
  return headingText
    ? { ...node, content: headingText, type: "heading" }
    : { ...node, type: "heading" };
}

/**
 * Owner decision 3: a block made by a slice arrives without an id and gets one
 * from an `attr` step. Only a block on an open side of the slice may carry an
 * id, because it is not new: it continues a block of the document. Which block
 * that is, and that the id matches it, only the replayer can tell.
 */
function newBlocksHaveNoId(parsed: Slice, path: string, replacesAtom = false): void {
  const last = parsed.content.length - 1;
  (parsed.content as (Inline | Block)[]).forEach((item, i) => {
    const continues = (i === 0 && "openStart" in parsed) || (i === last && "openEnd" in parsed);
    // Contract v4 §9, point 3: the atom that replaces an atom block continues it.
    const continuesAtom = replacesAtom && isAtomBlock(item);
    if (!isInline(item) && blockNodeId(item) !== null && !continues && !continuesAtom) {
      reject("new_block_has_id", `${path}.content[${i}]${isAtomBlock(item) ? "" : ".attrs"}.nodeId`);
    }
  });
  const [first, end] = [parsed.content[0] as Inline | Block, parsed.content[last] as Inline | Block];
  if (
    last > 0 &&
    !isInline(first) &&
    !isInline(end) &&
    blockNodeId(first) !== null &&
    blockNodeId(first) === blockNodeId(end)
  ) {
    reject("invalid_node_id", `${path}.content[${last}].attrs.nodeId`);
  }
}

/** Blocks or text, never a mix; an open side only on a slice of blocks. */
function slice(value: unknown, path: string, budget: Budget): Slice {
  const own = fields(value, path, ["content"], ["openStart", "openEnd"]);
  const raw = items(own.content, `${path}.content`, "invalid_slice");
  const first = raw[0];
  const isText =
    isPlainObject(first) &&
    Object.hasOwn(first, "type") &&
    (first.type === "text" || ATOM_SINCE.has(first.type));
  const content = isText
    ? inlines(raw, `${path}.content`, budget)
    : raw.map((item, i) => block(item, `${path}.content[${i}]`, budget));
  const parsed: Slice = { content: content as Slice["content"] };
  let open = 0;
  for (const side of ["openEnd", "openStart"] as const) {
    if (side in own) {
      if (own[side] !== 1 || isText) {
        reject("invalid_slice", `${path}.${side}`);
      }
      parsed[side] = 1;
      open += 1;
    }
  }
  // One block open on both sides brings only its text (or nothing): the same
  // step is written with a slice of text, or without a slice.
  if (open === 2 && content.length === 1) {
    reject("not_canonical", path);
  }
  return parsed;
}

/**
 * What a slice says about the two ends of the range it replaces. A position of
 * the F1 document lies between two blocks or inside one, and ProseMirror fits a
 * slice only where each end lies as deep as that side of the slice is open.
 */
type SliceKind = "none" | "text" | "closed" | "both" | "end" | "start";

function sliceKind(parsed: Slice | null): SliceKind {
  if (!parsed) {
    return "none";
  }
  if (isInline(parsed.content[0] as Inline | Block)) {
    return "text";
  }
  if ("openStart" in parsed) {
    return "openEnd" in parsed ? "both" : "start";
  }
  return "openEnd" in parsed ? "end" : "closed";
}

/**
 * Refuses what no document can make right, told from the step alone. In the
 * words of the replayer's obligations (description of #213):
 *   - a range that cannot exist: text or a slice open at its start put at
 *     position 0, which lies before the first block; a slice open only at its
 *     end put at one position; one position replaced by whole blocks;
 *   - the wrong record of what is removed: `structure` where the range must
 *     hold text or a whole block, a hash where it can hold only the start of
 *     a block;
 *   - a second record of the same change: a range that ends on the end of a
 *     block and a slice that puts an end of a block back.
 */
function replaceShape(
  from: number,
  to: number,
  structure: boolean,
  parsed: Slice | null,
  path: string,
  v4 = false,
): void {
  const kind = sliceKind(parsed);
  const width = to - from;
  // Open only at its start: at one position it fits nowhere, and over a range
  // the range ends between two blocks, so the end of a block is removed and
  // the slice, closed at its end, puts one back.
  if (kind === "start") {
    reject("not_canonical", `${path}.slice`);
  }
  if ((kind === "text" || kind === "both") && from === 0) {
    reject("invalid_position", `${path}.from`);
  }
  if (
    (kind === "end" && width === 0) ||
    (kind === "closed" && width === 1) ||
    // v4: the one position at 0 can be an atom block.
    (kind === "none" && width === 1 && from === 0 && !v4)
  ) {
    reject("invalid_position", `${path}.to`);
  }
  // One position at the start of a slice open only at its end is the start of
  // a block. Elsewhere only a join is made of boundaries alone: two positions
  // inside blocks, so never from position 0 and never under whole blocks.
  const startOfBlock = kind === "end" && width === 1;
  const maybeJoin = kind !== "end" && kind !== "closed" && width === 2 && from > 0;
  if (structure && width > 0 && !startOfBlock && !maybeJoin) {
    reject("not_canonical", `${path}.structure`);
  }
  if (!structure && startOfBlock) {
    reject("not_canonical", `${path}.removedSha256`);
  }
  if (!parsed) {
    return;
  }
  // Whole blocks after a block are written as a split of that block, and
  // whole blocks over whole blocks leave the last end of a block in place.
  if (kind === "closed" && to > 0) {
    reject("not_canonical", `${path}.slice`);
  }
  // The start of a block is removed and the last block of the slice writes it
  // again. With one block the slice begins with that same start; with more,
  // a last block without text ends with it. A different start would be a
  // change of the block's type or attributes, which is `replaceAround`.
  const single = parsed.content.length === 1;
  const lastIsEmpty = !("content" in (parsed.content[parsed.content.length - 1] as object));
  if (kind === "end" && ((width === 1 && (single || lastIsEmpty)) || (width === 2 && single))) {
    reject("not_canonical", `${path}.slice`);
  }
}

/** Blocks without text, open on both sides: the slice only divides a block. */
function isSplit(parsed: Slice): boolean {
  return (
    "openStart" in parsed &&
    "openEnd" in parsed &&
    (parsed.content as (Inline | Block)[]).every((item) => !isInline(item) && !isAtomBlock(item) && !("content" in item))
  );
}

/** A join removes the end of one block and the start of the next: two positions. */
const MAX_STRUCTURE_RANGE = 2;

function replaceStep(value: unknown, path: string, budget: Budget): EditStepV4 {
  const own = fields(
    value,
    path,
    ["stepType", "from", "to"],
    ["slice", "structure", "removedSha256"],
  );
  const from = position(own.from, `${path}.from`);
  const to = position(own.to, `${path}.to`);
  if (to < from || (to === from && !("slice" in own))) {
    reject("invalid_position", `${path}.to`);
  }
  if ("structure" in own && own.structure !== true) {
    reject("invalid_value", `${path}.structure`);
  }
  const removes = to > from && !("structure" in own);
  if (removes !== "removedSha256" in own) {
    reject(removes ? "missing_field" : "invalid_removed_hash", `${path}.removedSha256`);
  }
  if (removes && (typeof own.removedSha256 !== "string" || !SHA256_HEX.test(own.removedSha256))) {
    reject("invalid_removed_hash", `${path}.removedSha256`);
  }
  if ("structure" in own && to - from > MAX_STRUCTURE_RANGE) {
    reject("invalid_position", `${path}.to`);
  }
  const parsed = "slice" in own ? slice(own.slice, `${path}.slice`, budget) : null;
  // v4: whole atom blocks, boxes and code blocks put in at a block boundary
  // or over one atom block need no split (§9, point 3).
  const wholeV4 =
    budget.version === 4 &&
    parsed !== null &&
    sliceKind(parsed) === "closed" &&
    (parsed.content as Block[]).every((b) => isAtomBlock(b) || b.type === "box" || b.type === "codeBlock");
  const replacesAtom =
    wholeV4 && to - from === 1 && parsed.content.length === 1 && isAtomBlock(parsed.content[0] as Block);
  if (parsed) {
    newBlocksHaveNoId(parsed, `${path}.slice`, replacesAtom);
    // With nothing removed the flag changes nothing, so it would be a second
    // form of the same insertion. It is kept exactly where ProseMirror's own
    // split writes it, and refused everywhere else.
    if (to === from && "structure" in own !== isSplit(parsed)) {
      reject("not_canonical", `${path}.structure`);
    }
  }
  if (!wholeV4) replaceShape(from, to, "structure" in own, parsed, path, budget.version === 4);
  return {
    from,
    ...(removes ? { removedSha256: own.removedSha256 as string } : {}),
    ...(parsed ? { slice: parsed } : {}),
    stepType: "replace",
    ...("structure" in own ? { structure: true as const } : {}),
    to,
  };
}

/**
 * Only the form that changes the type or attributes of one block and keeps
 * its content: the gap is the whole inside of the block, and the slice is the
 * one new, empty block around it.
 */
/**
 * Contract v4 §9, point 5. Besides the change of one block's markup (below),
 * ProseMirror writes the wrapping of blocks in a box (`wrapIn`: the gap is
 * the whole range, the slice one empty box, `insert` 1) and the lifting of
 * the blocks out of a box (`lift`: the gap is the inside of the box, no slice,
 * `insert` 0). Which blocks lie under the range is the replayer's check.
 */
function replaceAroundV4(value: unknown, path: string, budget: Budget): EditStepV4 | null {
  const own = fields(value, path, ["stepType", "from", "to", "gapFrom", "gapTo", "insert", "structure"], ["slice"]);
  const from = position(own.from, `${path}.from`);
  const to = position(own.to, `${path}.to`);
  const gapFrom = position(own.gapFrom, `${path}.gapFrom`);
  const gapTo = position(own.gapTo, `${path}.gapTo`);
  if (own.structure !== true) reject("invalid_value", `${path}.structure`);
  if (own.insert !== 0 && own.insert !== 1) reject("invalid_value", `${path}.insert`);
  if (to <= from || gapTo < gapFrom || gapFrom < from || gapTo > to) reject("invalid_position", `${path}.from`);
  const parsed = "slice" in own ? slice(own.slice, `${path}.slice`, budget) : null;
  const only = parsed?.content[0] as Inline | Block | undefined;
  if (parsed) {
    if (parsed.content.length !== 1 || isInline(only!) || isAtomBlock(only!) || hasContent(only as Block) || "openStart" in parsed || "openEnd" in parsed) {
      reject("invalid_slice", `${path}.slice`);
    }
  }
  const around = gapFrom === from + 1 && gapTo === to - 1;
  const wrap = gapFrom === from && gapTo === to;
  // Markup change: the gap is the inside of one block. Wrap: the gap is the range.
  if (parsed && own.insert === 1 && (around || wrap)) {
    if (wrap && (only as { type: string }).type !== "box") reject("invalid_slice", `${path}.slice`);
    return { from, gapFrom, gapTo, insert: 1, slice: parsed as EditStepSliceV4, stepType: "replaceAround", structure: true, to };
  }
  // Lift: the blocks of a box, now without it.
  if (!parsed && own.insert === 0 && around) {
    return { from, gapFrom, gapTo, insert: 0, stepType: "replaceAround", structure: true, to };
  }
  return reject("invalid_position", `${path}.gapFrom`);
}

function replaceAroundStep(value: unknown, path: string, budget: Budget): EditStepV4 {
  if (budget.version === 4) return replaceAroundV4(value, path, budget)!;
  const own = fields(value, path, [
    "stepType",
    "from",
    "to",
    "gapFrom",
    "gapTo",
    "insert",
    "slice",
    "structure",
  ]);
  const from = position(own.from, `${path}.from`);
  const to = position(own.to, `${path}.to`);
  const gapFrom = position(own.gapFrom, `${path}.gapFrom`);
  const gapTo = position(own.gapTo, `${path}.gapTo`);
  if (gapFrom !== from + 1 || gapTo !== to - 1 || gapTo < gapFrom) {
    reject("invalid_position", `${path}.gapFrom`);
  }
  if (own.insert !== 1 || own.structure !== true) {
    reject("invalid_value", `${path}.${own.insert !== 1 ? "insert" : "structure"}`);
  }
  const parsed = slice(own.slice, `${path}.slice`, budget);
  const only = parsed.content[0] as Inline | Block;
  if (
    parsed.content.length !== 1 ||
    isInline(only) ||
    "content" in only ||
    "openStart" in parsed ||
    "openEnd" in parsed
  ) {
    reject("invalid_slice", `${path}.slice`);
  }
  return {
    from,
    gapFrom,
    gapTo,
    insert: 1,
    slice: parsed as EditStepSliceV3,
    stepType: "replaceAround",
    structure: true,
    to,
  };
}

function markStep(value: unknown, path: string, stepType: "addMark" | "removeMark", version: 1 | 2 | 3 | 4 = 3): EditStepV4 {
  const own = fields(value, path, ["stepType", "from", "to", "mark"]);
  const from = position(own.from, `${path}.from`);
  const to = position(own.to, `${path}.to`);
  if (to <= from) {
    reject("invalid_position", `${path}.to`);
  }
  // A mark range begins on a character, and position 0 is the start of a block.
  if (from === 0) {
    reject("invalid_position", `${path}.from`);
  }
  if (version === 4) {
    const parsedMark = markV4(own.mark, `${path}.mark`);
    // Contract v4 §3.1, §9 point 6: provenance marks enter and leave with the text.
    if (PROVENANCE_MARKS.has(parsedMark.type)) reject("invalid_mark", `${path}.mark.type`);
    return { from, mark: parsedMark, stepType, to };
  }
  return { from, mark: mark(own.mark, `${path}.mark`), stepType, to } as EditStepV4;
}

function attrStep(value: unknown, path: string): EditStepV4 {
  const own = fields(value, path, ["stepType", "pos", "attr", "value"]);
  const pos = position(own.pos, `${path}.pos`);
  if (own.attr !== "nodeId") {
    reject("invalid_value", `${path}.attr`);
  }
  if (!isStepNodeId(own.value)) {
    reject("invalid_node_id", `${path}.value`);
  }
  return { attr: "nodeId", pos, stepType: "attr", value: own.value };
}

/** A copy with the keys of every object in sorted order, as RFC 8785 writes them. */
function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortKeys) as T;
  }
  if (isPlainObject(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted as T;
  }
  return value;
}

function removedHash(value: unknown, path: string): string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    return reject("invalid_removed_hash", path);
  }
  return value;
}

/**
 * Contract §5.3. The record is read by the same validator as `sources` of a
 * document; its first fault is answered with `invalid_value` at that field.
 */
function sourceSetStep(value: unknown, path: string, budget: Budget): EditStepV4 {
  const own = fields(value, path, ["stepType", "source"], ["removedSha256"]);
  const hash =
    "removedSha256" in own ? removedHash(own.removedSha256, `${path}.removedSha256`) : null;
  spend(budget, MIN_OBJECT_BYTES, `${path}.source`);
  const errors: ValidationError[] = [];
  const [source] = validateSources([own.source], errors);
  if (errors.length > 0) {
    reject("invalid_value", `${path}.source${errors[0]!.path.slice("$.sources[0]".length)}`);
  }
  return {
    ...(hash === null ? {} : { removedSha256: hash }),
    source: sortKeys(source!),
    stepType: "sourceSet",
  };
}

/** Contract v4 §9, point 7: the whole cover, or none (then the old one's hash). */
function coverSetStep(value: unknown, path: string, budget: Budget): EditStepV4 {
  const own = fields(value, path, ["stepType"], ["cover", "removedSha256"]);
  const hash = "removedSha256" in own ? removedHash(own.removedSha256, `${path}.removedSha256`) : null;
  spend(budget, MIN_OBJECT_BYTES, path);
  if (!("cover" in own)) {
    // Removing needs a cover to remove, so the old one's hash.
    return hash === null ? reject("missing_field", `${path}.removedSha256`) : { removedSha256: hash, stepType: "coverSet" };
  }
  const errors: ValidationError[] = [];
  const cover = validateCover(own.cover, `${path}.cover`, errors);
  if (!cover || errors.length > 0) reject("invalid_value", errors[0]?.path ?? `${path}.cover`);
  return { cover: sortKeys(cover), ...(hash === null ? {} : { removedSha256: hash }), stepType: "coverSet" };
}

function sourceRemoveStep(value: unknown, path: string): EditStepV4 {
  const own = fields(value, path, ["stepType", "sourceId", "removedSha256"]);
  if (!isSourceId(own.sourceId)) {
    reject("invalid_value", `${path}.sourceId`);
  }
  const removedSha256 = removedHash(own.removedSha256, `${path}.removedSha256`);
  return { removedSha256, sourceId: own.sourceId, stepType: "sourceRemove" };
}

/**
 * Reads one step and charges its real canonical size. The result has sorted
 * keys, so `JSON.stringify` of it is the canonical form; it is serialised
 * once, which keeps the whole check linear in the size of the input.
 */
function step(value: unknown, path: string, budget: Budget): EditStepV4 {
  const parsed = stepShape(value, path, budget);
  budget.exact += utf8Length(JSON.stringify(parsed));
  if (budget.exact > MAX_EDIT_STEP_BYTES) {
    reject("too_large", path);
  }
  return parsed;
}

function stepShape(value: unknown, path: string, budget: Budget): EditStepV4 {
  if (!isPlainObject(value)) {
    reject("not_object", path);
  }
  const stepType = Object.hasOwn(value, "stepType") ? value.stepType : undefined;
  spend(budget, MIN_OBJECT_BYTES, path);
  switch (stepType) {
    case "replace":
      return replaceStep(value, path, budget);
    case "replaceAround":
      return replaceAroundStep(value, path, budget);
    case "addMark":
    case "removeMark":
      return markStep(value, path, stepType, budget.version);
    case "attr":
      return attrStep(value, path);
    case "sourceSet":
      return budget.version > 1 ? sourceSetStep(value, path, budget) : unknownStep(value, path);
    case "sourceRemove":
      return budget.version > 1 ? sourceRemoveStep(value, path) : unknownStep(value, path);
    case "coverSet":
      return budget.version === 4 ? coverSetStep(value, path, budget) : unknownStep(value, path);
    default:
      return unknownStep(value, path);
  }
}

function unknownStep(value: Record<string, unknown>, path: string): never {
  // Checked for forbidden keys first, so the answer names the worse fault.
  // One pass over the keys: looking each one up in a list of them all
  // would cost the square of their number.
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) {
      reject("forbidden_key", path);
    }
  }
  return reject("unknown_step_type", `${path}.stepType`);
}

function guarded<T>(parse: () => T): T | { ok: false; code: EditStepRejection; path: string } {
  try {
    return parse();
  } catch (error) {
    // Anything else (a throwing getter, a revoked proxy) is refused as well.
    return error instanceof Rejected
      ? { ok: false, code: error.code, path: error.path }
      : { ok: false, code: "unreadable", path: "$" };
  }
}

/** Reads one untrusted step of `EDIT_STEP_FORMAT_V1`. Never throws. */
export function parseEditStep(value: unknown): EditStepResult {
  return guarded(() => ({
    ok: true,
    // A v1 budget refuses citations and source steps, so the step is v1.
    step: step(value, "$", { floor: 0, exact: 0, version: 1 }) as EditStepV1,
  }));
}

/**
 * Reads the steps of one event recorded under `transactionFormat`, either
 * format. An unknown format is refused before a single step is looked at.
 * Never throws.
 */
export function parseEditSteps(
  transactionFormat: typeof EDIT_STEP_FORMAT_V1,
  steps: unknown,
): EditStepsResult;
export function parseEditSteps(
  transactionFormat: typeof EDIT_STEP_FORMAT_V2,
  steps: unknown,
): EditStepsV2Result;
export function parseEditSteps(
  transactionFormat: typeof EDIT_STEP_FORMAT_V3,
  steps: unknown,
): EditStepsV3Result;
export function parseEditSteps(
  transactionFormat: typeof EDIT_STEP_FORMAT_V4,
  steps: unknown,
): EditStepsV4Result;
export function parseEditSteps(
  transactionFormat: unknown,
  steps: unknown,
): EditStepsResult | EditStepsV2Result | EditStepsV3Result | EditStepsV4Result;
export function parseEditSteps(
  transactionFormat: unknown,
  steps: unknown,
): EditStepsResult | EditStepsV2Result | EditStepsV3Result | EditStepsV4Result {
  const version = FORMAT_VERSION.get(transactionFormat);
  if (version === undefined) {
    return { ok: false, code: "unsupported_format", path: "$" };
  }
  return guarded(() => {
    if (!Array.isArray(steps)) {
      return reject("steps_not_array", "$");
    }
    // One budget for the event: all of its steps travel in one segment. The
    // array costs its two brackets and one comma between neighbours.
    const budget: Budget = { floor: 0, exact: 2, version };
    const list = items(steps, "$", "steps_empty");
    return {
      ok: true,
      steps: list.map((item, i) => {
        budget.exact += i === 0 ? 0 : 1;
        return step(item, `$[${i}]`, budget);
      }),
    } as EditStepsResult | EditStepsV2Result | EditStepsV3Result | EditStepsV4Result;
  });
}

/** Each accepted format and the schema version whose steps it writes (§5.4, v3 §5). */
const FORMAT_VERSION: ReadonlyMap<unknown, 1 | 2 | 3 | 4> = new Map([
  [EDIT_STEP_FORMAT_V1, 1],
  [EDIT_STEP_FORMAT_V2, 2],
  [EDIT_STEP_FORMAT_V3, 3],
  [EDIT_STEP_FORMAT_V4, 4],
]);
