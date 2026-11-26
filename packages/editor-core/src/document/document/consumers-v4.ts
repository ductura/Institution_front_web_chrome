/**
 * The consumers of document v4 (docs/contracts/document-schema-v4.md §11):
 * normalisation, equality, text blocks and word count. v1 to v3 keep their
 * own functions; v4 has a module of its own until `VersionedDocument` takes
 * it. Pure and total: no input throws.
 */

import {
  DOCUMENT_SCHEMA_VERSION_V4,
  MARK_V4_ORDER,
  markV4Type,
  newNodeId,
  paragraphNode,
  type BoxNode,
  type CanonicalDocumentV4,
  type DocumentNodeV4,
  type InlineNodeV4,
  type MarkV4,
  type ParagraphNodeV4,
} from "./schema";
import { marksV4Key } from "./validate-marks-v4";

/** Marks of one type once, in canonical order (contract §3); the first wins. */
export function canonicalMarksV4(marks: readonly MarkV4[]): MarkV4[] {
  const byType = new Map<string, MarkV4>();
  for (const mark of marks) {
    if (!byType.has(markV4Type(mark))) byType.set(markV4Type(mark), mark);
  }
  return MARK_V4_ORDER.flatMap((type) => (byType.has(type) ? [byType.get(type)!] : []));
}

function normalizeChildren(children: readonly InlineNodeV4[]): InlineNodeV4[] {
  const result: InlineNodeV4[] = [];
  for (const child of children) {
    if (child.type !== "text") {
      result.push(structuredClone(child));
      continue;
    }
    if (child.text.length === 0) continue;
    const marks = canonicalMarksV4(child.marks);
    const previous = result[result.length - 1];
    if (previous?.type === "text" && marksV4Key(previous.marks) === marksV4Key(marks)) {
      result[result.length - 1] = { type: "text", text: previous.text + child.text, marks: previous.marks };
      continue;
    }
    result.push({ type: "text", text: child.text, marks: structuredClone(marks) });
  }
  return result;
}

function normalizeNode(node: DocumentNodeV4): DocumentNodeV4 {
  switch (node.type) {
    case "table":
    case "image":
    case "formula":
    case "pageBreak":
      return structuredClone(node);
    case "box":
      return { ...node, children: node.children.map((child) => normalizeNode(child) as ParagraphNodeV4) };
    default:
      return { ...structuredClone(node), children: normalizeChildren(node.children) } as DocumentNodeV4;
  }
}

/** A new document; `doc` is never mutated. Idempotent. */
export function normalizeDocumentV4(doc: CanonicalDocumentV4, uuidFn?: () => string): CanonicalDocumentV4 {
  const normalized = doc.nodes.map(normalizeNode);
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION_V4,
    nodes: normalized.length === 0 ? [paragraphNode(newNodeId(uuidFn)) as DocumentNodeV4] : normalized,
    sources: structuredClone(doc.sources),
    ...(doc.cover !== undefined ? { cover: structuredClone(doc.cover) } : {}),
  };
}

/** JSON data equality; a key holding `undefined` counts as absent. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = (o: Record<string, unknown>) => Object.keys(o).filter((key) => o[key] !== undefined);
  const xKeys = keys(x);
  return xKeys.length === keys(y).length && xKeys.every((key) => Object.hasOwn(y, key) && jsonEqual(x[key], y[key]));
}

function without(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(without);
  if (typeof node !== "object" || node === null) return node;
  const { id: _id, ...rest } = node as Record<string, unknown>;
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, without(value)]));
}

/** Full equality, node ids included; an absent field is not an existing one. */
export function documentsEqualV4(a: CanonicalDocumentV4, b: CanonicalDocumentV4): boolean {
  return jsonEqual(a, b);
}

/** Equality ignoring the `id` of every block (also in a box). */
export function contentEqualV4(a: CanonicalDocumentV4, b: CanonicalDocumentV4): boolean {
  return jsonEqual(without(a), without(b));
}

export type TextBlockV4 = {
  kind: "heading" | "paragraph" | "bulletItem" | "orderedItem" | "quote" | "codeBlock";
  text: string;
};

/**
 * Text blocks in document order: a paragraph in a box is a block of its own,
 * a code block a block with its text, an inline formula has no characters,
 * a table, image, formula and page break no text (contract §11).
 */
export function textBlocksOfV4(doc: CanonicalDocumentV4): TextBlockV4[] {
  const blocks: TextBlockV4[] = [];
  const visit = (node: DocumentNodeV4 | BoxNode): void => {
    switch (node.type) {
      case "box":
        node.children.forEach(visit);
        return;
      case "table":
      case "image":
      case "formula":
      case "pageBreak":
        return;
      default:
        blocks.push({
          kind: node.type,
          text: (node.children as readonly InlineNodeV4[]).map((child) => (child.type === "text" ? child.text : "")).join(""),
        });
    }
  };
  doc.nodes.forEach(visit);
  return blocks;
}

/**
 * Words of paragraphs (also in a box), headings, bullet items and quotes. A
 * code block, a table cell, a figure title and source and a formula are not
 * counted; an inline formula and any other atom separate words (§11).
 */
export function documentWordCountV4(doc: CanonicalDocumentV4): number {
  let total = 0;
  const count = (children: readonly InlineNodeV4[]): void => {
    const text = children.map((child) => (child.type === "text" ? child.text : " ")).join("");
    for (const word of text.split(/\s+/u)) if (word.length > 0) total += 1;
  };
  const visit = (node: DocumentNodeV4): void => {
    if (node.type === "box") node.children.forEach(visit);
    else if (node.type === "paragraph" || node.type === "heading" || node.type === "bulletItem" || node.type === "orderedItem" || node.type === "quote") {
      count(node.children as readonly InlineNodeV4[]);
    }
  };
  doc.nodes.forEach(visit);
  return total;
}
