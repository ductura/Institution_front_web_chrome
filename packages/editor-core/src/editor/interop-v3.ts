/**
 * Canonical document v3 ↔ Tiptap JSON (document-schema-v3 §3 and §5). The v2
 * projection with three atoms: the citation with `via` and `rq`, the
 * footnote (`text`) and the cross reference (`targetId`). An atom is never
 * repaired: a mark, an unknown key or attribute is reported, and
 * `validateVersionedDocument` stays the last gate for the values. Absent
 * optional attributes are `null` in Tiptap and absent in the document.
 *
 * Like `interop.ts`, this module does not import Tiptap.
 */

import {
  DOCUMENT_SCHEMA_VERSION_V3,
  normalizeDocument,
  validateVersionedDocument,
  type CanonicalDocumentV3,
  type DocumentNodeV3,
  type InlineNodeV3,
  type NodeId,
  type SourceId,
  type ValidationError,
} from "../document/document";
import { validateSources } from "../document/document/validate-sources";
import { isPlainObject } from "../document/json";
import {
  defaultIdFactory,
  inlineToTiptap,
  NODE_ID_ATTRIBUTE,
  projectInline,
  projectTiptapBlocks,
  type IdFactory,
  type InteropError,
  type TiptapNodeJSON,
} from "./interop";

export type TiptapDocumentJSONV3 = {
  type: "doc";
  attrs: { sources: CanonicalDocumentV3["sources"] };
  content: TiptapNodeJSON[];
};

export type CanonicalCandidateV3 =
  | { ok: true; doc: CanonicalDocumentV3 }
  | { ok: false; errors: InteropError[] };

const ATTRS_BY_ATOM: Readonly<Record<string, ReadonlySet<string>>> = {
  citation: new Set(["sourceId", "locator", "via", "rq"]),
  footnote: new Set(["text"]),
  crossReference: new Set(["targetId"]),
};
const ATOM_KEYS = new Set(["type", "attrs", "marks"]);

/* ------------------------------------------------------- canonical → tiptap */

function atomToTiptap(atom: Exclude<InlineNodeV3, { type: "text" }>): TiptapNodeJSON {
  switch (atom.type) {
    case "citation":
      return {
        type: "citation",
        attrs: { sourceId: atom.sourceId, locator: atom.locator ?? null, via: atom.via ?? null, rq: atom.rq ?? null },
      };
    case "footnote":
      return { type: "footnote", attrs: { text: atom.text } };
    case "crossReference":
      return { type: "crossReference", attrs: { targetId: atom.targetId } };
  }
}

function nodeToTiptapV3(node: DocumentNodeV3): TiptapNodeJSON {
  const attrs: Record<string, unknown> =
    node.type === "heading" ? { [NODE_ID_ATTRIBUTE]: node.id, level: node.level } : { [NODE_ID_ATTRIBUTE]: node.id };
  const children: readonly InlineNodeV3[] = node.children;
  return children.length === 0
    ? { type: node.type, attrs }
    : {
        type: node.type,
        attrs,
        content: children.map((child) => (child.type === "text" ? inlineToTiptap(child) : atomToTiptap(child))),
      };
}

/** Projects a v3 document onto Tiptap JSON. Total: cannot fail. */
export function canonicalToTiptapV3(doc: CanonicalDocumentV3): TiptapDocumentJSONV3 {
  return { type: "doc", attrs: { sources: structuredClone(doc.sources) }, content: doc.nodes.map(nodeToTiptapV3) };
}

/* ------------------------------------------------------- tiptap → canonical */

function projectAtom(raw: Record<string, unknown>, path: string, errors: InteropError[]): InlineNodeV3 | null {
  const type = raw.type as string;
  if (Object.keys(raw).some((key) => !ATOM_KEYS.has(key))) {
    errors.push({ path, code: "TIPTAP_CITATION_INVALID" });
    return null;
  }
  if (raw.marks !== undefined && !(Array.isArray(raw.marks) && raw.marks.length === 0)) {
    errors.push({ path: `${path}.marks`, code: "TIPTAP_CITATION_MARKED" });
    return null;
  }
  const attrs = raw.attrs;
  if (!isPlainObject(attrs) || Object.keys(attrs).some((key) => !ATTRS_BY_ATOM[type]!.has(key))) {
    errors.push({ path: `${path}.attrs`, code: "TIPTAP_CITATION_INVALID" });
    return null;
  }
  const given = (key: string) => attrs[key] !== null && attrs[key] !== undefined;
  if (type === "footnote") return { type, text: attrs.text as string };
  if (type === "crossReference") return { type, targetId: attrs.targetId as NodeId };
  return {
    type: "citation",
    sourceId: attrs.sourceId as SourceId,
    ...(given("locator") ? { locator: attrs.locator as string } : {}),
    ...(given("via") ? { via: attrs.via as string } : {}),
    ...(given("rq") ? { rq: attrs.rq as never } : {}),
  };
}

function projectInlineV3(raw: unknown, path: string, errors: InteropError[]): InlineNodeV3 | null {
  return isPlainObject(raw) && typeof raw.type === "string" && raw.type in ATTRS_BY_ATOM
    ? projectAtom(raw, path, errors)
    : projectInline(raw, path, errors);
}

/**
 * Projects Tiptap JSON of the v3 editor back onto a v3 document: projection,
 * `normalizeDocument`, then `validateVersionedDocument`.
 */
export function tiptapToCanonicalV3(
  json: unknown,
  idFor: IdFactory = defaultIdFactory,
  uuidFn?: () => string,
): CanonicalCandidateV3 {
  const projected = projectTiptapBlocks(json, idFor, projectInlineV3 as never);
  if (Array.isArray(projected)) return { ok: false, errors: projected };

  const root = json as Record<string, unknown>;
  const errors = [...projected.errors];
  let sources: unknown = [];
  if (root.attrs !== undefined) {
    if (!isPlainObject(root.attrs)) {
      errors.push({ path: "$.attrs", code: "TIPTAP_ATTRS_NOT_OBJECT" });
    } else if (root.attrs.sources !== undefined) {
      if (Array.isArray(root.attrs.sources)) {
        const sourceErrors: ValidationError[] = [];
        sources = validateSources(root.attrs.sources, sourceErrors);
        errors.push(...sourceErrors);
      } else {
        errors.push({ path: "$.attrs.sources", code: "SOURCES_NOT_ARRAY" });
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const normalized = normalizeDocument(
    {
      schemaVersion: DOCUMENT_SCHEMA_VERSION_V3,
      nodes: projected.nodes as DocumentNodeV3[],
      sources: sources as CanonicalDocumentV3["sources"],
    },
    uuidFn,
  );
  const validated = validateVersionedDocument(normalized);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  return { ok: true, doc: validated.doc as CanonicalDocumentV3 };
}
