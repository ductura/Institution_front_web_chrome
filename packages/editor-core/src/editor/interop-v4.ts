/**
 * Canonical document v4 ↔ Tiptap JSON (docs/contracts/document-schema-v4.md,
 * §2 to §7 and the last paragraph of §9). Every block and atom is a node of
 * the name of its `type`; its attributes are the fields of the document
 * without `type`, `id` and `children`, an absent optional field being `null`,
 * plus the block's `nodeId`. A mark with attributes is `{type, attrs}` with
 * the same attribute names; one without is `{type}`.
 *
 * As in v3, nothing that is an atom (inline or block) is repaired: a mark on
 * an inline atom, an unknown key or attribute is reported, and
 * `validateDocumentV4` stays the last gate for every value. The one thing
 * read leniently is an empty optional field (`""`, `[]`), which the client
 * never stores (contract "Za klijenta"): it counts as absent.
 *
 * Like `interop.ts`, this module does not import Tiptap.
 */

import {
  canonicalMarksV4,
  DOCUMENT_SCHEMA_VERSION_V4,
  isHeadingLevel,
  isNodeId,
  MARK_V4_ORDER,
  markV4Type,
  newNodeId,
  normalizeDocumentV4,
  validateDocumentV4,
  type CanonicalDocumentV4,
  type CoverV4,
  type DocumentNodeV4,
  type InlineNodeV4,
  type MarkV4,
  type NodeId,
  type ParagraphNodeV4,
  type TextNodeV4,
  type ValidationError,
} from "../document/document";
import { validateSources } from "../document/document/validate-sources";
import { isPlainObject } from "../document/json";
import {
  defaultIdFactory,
  NODE_ID_ATTRIBUTE,
  type IdFactory,
  type InteropError,
  type TiptapMarkJSON,
  type TiptapNodeJSON,
} from "./interop";

export type TiptapDocumentJSONV4 = {
  type: "doc";
  attrs: { sources: CanonicalDocumentV4["sources"]; cover: CoverV4 | null };
  content: TiptapNodeJSON[];
};

export type CanonicalCandidateV4 =
  | { ok: true; doc: CanonicalDocumentV4 }
  | { ok: false; errors: InteropError[] };

export type BlockAtomType = "table" | "image" | "formula" | "pageBreak";
export type BlockAtomNode = Extract<DocumentNodeV4, { type: BlockAtomType }>;

/** The fields of each atom block, in the order of the editor's attributes. */
export const BLOCK_ATOM_FIELDS: Readonly<Record<BlockAtomType, readonly string[]>> = {
  table: ["rows", "header", "stripes", "landscape", "headerFill", "cellFills", "merges", "title", "source"],
  image: ["attachmentId", "attachmentSha256", "crop", "widthPercent", "align", "landscape", "title", "source"],
  formula: ["tex"],
  pageBreak: [],
};
const OPTIONAL_FIELDS = new Set([
  "headerFill", "cellFills", "merges", "title", "source", "attachmentId", "attachmentSha256", "crop",
]);
const TEXT_BLOCKS = new Set(["paragraph", "heading", "bulletItem", "quote", "codeBlock"]);
export const isBlockAtomType = (type: string): type is BlockAtomType => Object.hasOwn(BLOCK_ATOM_FIELDS, type);

/** Attributes of each inline atom (contract v3 §3, v4 §4.1). */
const INLINE_ATOM_ATTRS: Readonly<Record<string, readonly string[]>> = {
  citation: ["sourceId", "locator", "via", "rq"],
  footnote: ["text"],
  crossReference: ["targetId"],
  inlineFormula: ["tex"],
};
/** Attributes of each mark with attributes (contract §3). */
const MARK_ATTRS: Readonly<Record<string, readonly string[]>> = {
  highlight: ["color"],
  lang: ["lang"],
  link: ["href"],
  paste: ["pasteId", "sourceId"],
};
const LEAF_KEYS = new Set(["type", "attrs", "marks"]);

/** Absent, `null`, `""` and `[]` all mean "no value" for an optional field. */
const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** JSON data only: what `structuredClone` and the validator can read without throwing. */
function isJsonData(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonData(item, depth + 1));
  return isPlainObject(value) && Object.values(value).every((item) => isJsonData(item, depth + 1));
}

const isUnmarked = (marks: unknown) => marks === undefined || (Array.isArray(marks) && marks.length === 0);

/* ------------------------------------------------------- canonical → tiptap */

export function markToTiptapV4(mark: MarkV4): TiptapMarkJSON {
  if (typeof mark === "string") return { type: mark };
  if (mark.type === "paste") return { type: "paste", attrs: { pasteId: mark.pasteId, sourceId: mark.sourceId ?? null } };
  const { type, ...attrs } = mark;
  return { type, attrs: { ...attrs } };
}

function inlineToTiptapV4(child: InlineNodeV4): TiptapNodeJSON {
  switch (child.type) {
    case "text":
      return child.marks.length === 0
        ? { type: "text", text: child.text }
        : { type: "text", text: child.text, marks: canonicalMarksV4(child.marks).map(markToTiptapV4) };
    case "citation":
      return {
        type: "citation",
        attrs: { sourceId: child.sourceId, locator: child.locator ?? null, via: child.via ?? null, rq: child.rq ?? null },
      };
    case "footnote":
      return { type: "footnote", attrs: { text: child.text } };
    case "crossReference":
      return { type: "crossReference", attrs: { targetId: child.targetId } };
    case "inlineFormula":
      return { type: "inlineFormula", attrs: { tex: child.tex } };
  }
}

/** The editor attributes of an atom block, without `nodeId`; absent optional fields are `null`. */
export function blockAtomToAttrs(node: BlockAtomNode): Record<string, unknown> {
  const fields = node as unknown as Record<string, unknown>;
  return Object.fromEntries(BLOCK_ATOM_FIELDS[node.type].map((key) => [key, structuredClone(fields[key] ?? null)]));
}

function nodeToTiptapV4(node: DocumentNodeV4): TiptapNodeJSON {
  const id = { [NODE_ID_ATTRIBUTE]: node.id };
  if (isBlockAtomType(node.type)) return { type: node.type, attrs: { ...id, ...blockAtomToAttrs(node as BlockAtomNode) } };
  if (node.type === "box") return { type: "box", attrs: { ...id, kind: node.kind }, content: node.children.map(nodeToTiptapV4) };
  const attrs: Record<string, unknown> =
    node.type === "heading"
      ? { ...id, level: node.level }
      : node.type === "paragraph"
        ? { ...id, variantGroup: node.variantGroup ?? null }
        : node.type === "codeBlock"
          ? { ...id, language: node.language ?? null, caption: node.caption ?? null }
          : id;
  const children: readonly InlineNodeV4[] = (node as { children: InlineNodeV4[] }).children;
  // As in v1: an empty textblock has no `content`, like Tiptap's `getJSON()`.
  return children.length === 0 ? { type: node.type, attrs } : { type: node.type, attrs, content: children.map(inlineToTiptapV4) };
}

/** Projects a v4 document onto Tiptap JSON. Total: cannot fail. */
export function canonicalToTiptapV4(doc: CanonicalDocumentV4): TiptapDocumentJSONV4 {
  return {
    type: "doc",
    attrs: { sources: structuredClone(doc.sources), cover: doc.cover === undefined ? null : structuredClone(doc.cover) },
    content: doc.nodes.map(nodeToTiptapV4),
  };
}

/* ------------------------------------------------------- tiptap → canonical */

/**
 * The canonical fields of an atom block from its editor attributes: an
 * optional field without a value is left out, everything else is copied as
 * it is for the validator to judge. Unknown attributes are the caller's.
 */
export function blockAtomFromAttrs(type: BlockAtomType, attrs: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of BLOCK_ATOM_FIELDS[type]) {
    const value = attrs[key];
    if (OPTIONAL_FIELDS.has(key) ? isEmpty(value) : value === undefined) continue;
    fields[key] = structuredClone(value);
  }
  return fields;
}

type Ctx = { seen: Set<string>; idFor: IdFactory; count: number; errors: InteropError[] };

/** The attributes of a node or mark, or null with an error when they are not JSON data. */
function attrsOf(raw: Record<string, unknown>, path: string, errors: InteropError[]): Record<string, unknown> | null {
  if (raw.attrs === undefined) return {};
  if (!isPlainObject(raw.attrs) || !isJsonData(raw.attrs)) {
    errors.push({ path: `${path}.attrs`, code: "TIPTAP_ATTRS_NOT_OBJECT" });
    return null;
  }
  return raw.attrs;
}

/**
 * As in v1 (`interop.ts`): a missing id, or one already seen in the
 * document (a box's paragraphs included), is minted anew; a malformed one is
 * reported, never repaired. `idFor` gets the block's number in document order.
 */
function resolveId(attrs: Record<string, unknown>, path: string, ctx: Ctx): NodeId | null {
  const index = ctx.count++;
  const raw = attrs[NODE_ID_ATTRIBUTE];
  if (raw !== undefined && raw !== null) {
    if (!isNodeId(raw)) {
      ctx.errors.push({ path: `${path}.attrs.${NODE_ID_ATTRIBUTE}`, code: "TIPTAP_NODE_ID_INVALID" });
      return null;
    }
    if (!ctx.seen.has(raw.toLowerCase())) {
      ctx.seen.add(raw.toLowerCase());
      return raw;
    }
  }
  let id = ctx.idFor(index);
  while (ctx.seen.has(id.toLowerCase())) id = newNodeId();
  ctx.seen.add(id.toLowerCase());
  return id;
}

function projectMarksV4(raw: unknown, path: string, errors: InteropError[]): MarkV4[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ path: `${path}.marks`, code: "TIPTAP_MARKS_NOT_ARRAY" });
    return null;
  }
  const marks: MarkV4[] = [];
  const before = errors.length;
  raw.forEach((rawMark: unknown, index) => {
    const markPath = `${path}.marks[${index}]`;
    if (!isPlainObject(rawMark)) {
      errors.push({ path: markPath, code: "TIPTAP_MARK_NOT_OBJECT" });
      return;
    }
    const type = rawMark.type;
    if (typeof type !== "string" || !(MARK_V4_ORDER as readonly string[]).includes(type)) {
      errors.push({ path: `${markPath}.type`, code: "TIPTAP_UNKNOWN_MARK" });
      return;
    }
    const attrs = attrsOf(rawMark, markPath, errors);
    if (!attrs) return;
    const allowed = MARK_ATTRS[type] ?? [];
    if (Object.keys(attrs).some((key) => !allowed.includes(key))) {
      errors.push({ path: `${markPath}.attrs`, code: "UNKNOWN_FIELD" });
      return;
    }
    // Two marks of one type would lose one in `canonicalMarksV4`.
    if (marks.some((seen) => markV4Type(seen) === type)) {
      errors.push({ path: markPath, code: "MARKS_DUPLICATE" });
      return;
    }
    if (allowed.length === 0) {
      marks.push(type as MarkV4);
      return;
    }
    const mark: Record<string, unknown> = { type };
    // A required attribute is copied even when null, so the validator names it.
    for (const key of allowed) if (key !== "sourceId" || !isEmpty(attrs[key])) mark[key] = attrs[key];
    marks.push(mark as MarkV4);
  });
  return errors.length > before ? null : canonicalMarksV4(marks);
}

function projectInlineV4(raw: unknown, path: string, errors: InteropError[]): InlineNodeV4 | null {
  if (!isPlainObject(raw)) {
    errors.push({ path, code: "TIPTAP_NODE_NOT_OBJECT" });
    return null;
  }
  const type = raw.type;
  if (type === "text") {
    if (typeof raw.text !== "string") {
      errors.push({ path: `${path}.text`, code: "TIPTAP_INLINE_TEXT_NOT_STRING" });
      return null;
    }
    const marks = projectMarksV4(raw.marks, path, errors);
    return marks === null ? null : { type: "text", text: raw.text, marks };
  }
  if (typeof type !== "string" || !Object.hasOwn(INLINE_ATOM_ATTRS, type)) {
    errors.push({ path: `${path}.type`, code: "TIPTAP_UNKNOWN_NODE_TYPE" });
    return null;
  }
  if (Object.keys(raw).some((key) => !LEAF_KEYS.has(key))) {
    errors.push({ path, code: "TIPTAP_CITATION_INVALID" });
    return null;
  }
  if (!isUnmarked(raw.marks)) {
    errors.push({ path: `${path}.marks`, code: "TIPTAP_CITATION_MARKED" });
    return null;
  }
  const attrs = attrsOf(raw, path, errors);
  if (!attrs) return null;
  const allowed = INLINE_ATOM_ATTRS[type]!;
  if (Object.keys(attrs).some((key) => !allowed.includes(key))) {
    errors.push({ path: `${path}.attrs`, code: "TIPTAP_CITATION_INVALID" });
    return null;
  }
  const atom: Record<string, unknown> = { type };
  for (const key of allowed) {
    // `locator`, `via` and `rq` of a citation are optional; the rest required.
    const optional = type === "citation" && key !== "sourceId";
    if (optional ? !isEmpty(attrs[key]) : attrs[key] !== undefined) atom[key] = attrs[key];
  }
  return atom as InlineNodeV4;
}

function projectBlockV4(raw: unknown, path: string, ctx: Ctx): DocumentNodeV4 | null {
  const { errors } = ctx;
  if (!isPlainObject(raw)) {
    errors.push({ path, code: "TIPTAP_NODE_NOT_OBJECT" });
    return null;
  }
  const type = raw.type;
  if (typeof type !== "string" || !(TEXT_BLOCKS.has(type) || type === "box" || isBlockAtomType(type))) {
    errors.push({ path: `${path}.type`, code: "TIPTAP_UNKNOWN_NODE_TYPE" });
    return null;
  }
  const attrs = attrsOf(raw, path, errors);
  if (!attrs) return null;
  const id = resolveId(attrs, path, ctx);

  if (isBlockAtomType(type)) {
    const allowed = [NODE_ID_ATTRIBUTE, ...BLOCK_ATOM_FIELDS[type]];
    if (Object.keys(raw).some((key) => !LEAF_KEYS.has(key)) || !isUnmarked(raw.marks)) {
      errors.push({ path, code: "TIPTAP_CITATION_INVALID" });
      return null;
    }
    if (Object.keys(attrs).some((key) => !allowed.includes(key))) {
      errors.push({ path: `${path}.attrs`, code: "TIPTAP_CITATION_INVALID" });
      return null;
    }
    return id === null ? null : ({ type, id, ...blockAtomFromAttrs(type, attrs) } as DocumentNodeV4);
  }

  if (raw.content !== undefined && !Array.isArray(raw.content)) {
    errors.push({ path: `${path}.content`, code: "TIPTAP_CONTENT_NOT_ARRAY" });
    return null;
  }
  const content: unknown[] = (raw.content as unknown[] | undefined) ?? [];
  if (type === "box") {
    // Any block is read here; the validator refuses what a box cannot hold.
    const children = content.flatMap((child, i) => projectBlockV4(child, `${path}.content[${i}]`, ctx) ?? []);
    return id === null ? null : ({ type, id, kind: attrs.kind, children: children as ParagraphNodeV4[] } as DocumentNodeV4);
  }
  const children = content.flatMap((child, i) => projectInlineV4(child, `${path}.content[${i}]`, errors) ?? []);
  if (type === "heading" && !isHeadingLevel(attrs.level)) {
    errors.push({ path: `${path}.attrs.level`, code: "TIPTAP_HEADING_LEVEL_INVALID" });
    return null;
  }
  if (id === null) return null;
  switch (type) {
    case "heading":
      return { type, id, level: attrs.level as 1 | 2 | 3, children: children as TextNodeV4[] };
    case "paragraph":
      return { type, id, children, ...(isEmpty(attrs.variantGroup) ? {} : { variantGroup: attrs.variantGroup as string }) };
    case "codeBlock":
      return {
        type,
        id,
        children: children as TextNodeV4[],
        ...(isEmpty(attrs.language) ? {} : { language: attrs.language as never }),
        ...(isEmpty(attrs.caption) ? {} : { caption: attrs.caption as string }),
      };
    default:
      return { type: type as "bulletItem" | "quote", id, children };
  }
}

/** The cover of the document node: absent, `null` or without a value is no cover. */
function projectCover(raw: unknown, errors: InteropError[]): CoverV4 | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw) || !isJsonData(raw)) {
    errors.push({ path: "$.attrs.cover", code: "COVER_INVALID" });
    return undefined;
  }
  const cover = Object.fromEntries(Object.entries(raw).filter(([, value]) => !isEmpty(value)));
  return Object.keys(cover).length === 0 ? undefined : (cover as CoverV4);
}

/**
 * Projects Tiptap JSON of the v4 editor back onto a v4 document: projection,
 * `normalizeDocumentV4`, then `validateDocumentV4`. Paths of the errors of
 * the projection are in Tiptap JSON, those of the validator in the document.
 */
export function tiptapToCanonicalV4(
  json: unknown,
  idFor: IdFactory = defaultIdFactory,
  uuidFn?: () => string,
): CanonicalCandidateV4 {
  if (!isPlainObject(json)) return { ok: false, errors: [{ path: "$", code: "TIPTAP_NOT_OBJECT" }] };
  if (json.type !== "doc") return { ok: false, errors: [{ path: "$.type", code: "TIPTAP_ROOT_TYPE_INVALID" }] };
  if (!Array.isArray(json.content)) return { ok: false, errors: [{ path: "$.content", code: "TIPTAP_CONTENT_NOT_ARRAY" }] };

  const ctx: Ctx = { seen: new Set(), idFor, count: 0, errors: [] };
  const nodes = (json.content as unknown[]).flatMap((raw, i) => projectBlockV4(raw, `$.content[${i}]`, ctx) ?? []);
  const { errors } = ctx;
  let sources: unknown = [];
  let cover: CoverV4 | undefined;
  if (json.attrs !== undefined) {
    if (!isPlainObject(json.attrs)) {
      errors.push({ path: "$.attrs", code: "TIPTAP_ATTRS_NOT_OBJECT" });
    } else {
      if (json.attrs.sources !== undefined) {
        // Checked before `normalizeDocumentV4` clones the list (see interop-v2).
        if (Array.isArray(json.attrs.sources)) {
          const sourceErrors: ValidationError[] = [];
          sources = validateSources(json.attrs.sources, sourceErrors);
          errors.push(...sourceErrors);
        } else {
          errors.push({ path: "$.attrs.sources", code: "SOURCES_NOT_ARRAY" });
        }
      }
      cover = projectCover(json.attrs.cover, errors);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const normalized = normalizeDocumentV4(
    {
      schemaVersion: DOCUMENT_SCHEMA_VERSION_V4,
      nodes,
      sources: sources as CanonicalDocumentV4["sources"],
      ...(cover ? { cover } : {}),
    },
    uuidFn,
  );
  const validated = validateDocumentV4(normalized);
  return validated.ok ? { ok: true, doc: validated.doc } : { ok: false, errors: validated.errors };
}
