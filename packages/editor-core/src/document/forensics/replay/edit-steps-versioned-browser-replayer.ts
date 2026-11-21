import { getSchema } from "@tiptap/core";
import { Fragment, type Node as PmNode, type Schema } from "@tiptap/pm/model";

import { createEditorExtensionsV2, createEditorExtensionsV3, createEditorExtensionsV4 } from "../../../editor/schema";
import { canonicalToTiptapV2, tiptapToCanonicalV2 } from "../../../editor/interop-v2";
import { canonicalToTiptapV3, tiptapToCanonicalV3 } from "../../../editor/interop-v3";
import { canonicalToTiptapV4, tiptapToCanonicalV4 } from "../../../editor/interop-v4";
import { validateVersionedDocument } from "../../document";
import {
  EDIT_STEP_FORMAT_V2,
  EDIT_STEP_FORMAT_V3,
  EDIT_STEP_FORMAT_V4,
  parseEditSteps,
  type EditStepV3,
  type EditStepV4,
} from "../../document/edit-step";
import { validateDocumentV4 } from "../../document/validate-v4";
import { MAX_DOCUMENT_SOURCES, type DocumentSource } from "../../document/schema";
import { sha256WebCrypto } from "../crypto";
import { EvidenceContentNotSupportedV2, type AsyncEvidenceStepReplayerV2 } from "../evidence-replay-v2";
import { canonicalizeJcs, type JcsJsonValue } from "../jcs";
import { applyPmStep, checkContentStep, namesUnknownType, refuse } from "./edit-steps-v1-rules";
import { checkBlockIdentity, checkContentStepV4, coverCanonical } from "./edit-steps-v4-rules";

export type AcademicSchemaVersion = 2 | 3 | 4;
export const academicStepFormat = {
  2: EDIT_STEP_FORMAT_V2,
  3: EDIT_STEP_FORMAT_V3,
  4: EDIT_STEP_FORMAT_V4,
} as const;

const schemas = new Map<AcademicSchemaVersion, Schema>();

function replaySchema(version: AcademicSchemaVersion): Schema {
  const cached = schemas.get(version);
  if (cached) return cached;
  const schema = getSchema(
    version === 4 ? createEditorExtensionsV4() : version === 3 ? createEditorExtensionsV3() : createEditorExtensionsV2(),
  );
  schemas.set(version, schema);
  return schema;
}

function isInlineAtom(node: PmNode): boolean {
  return node.isInline && node.isAtom && !node.isText;
}

export function unmarkInlineAtoms(doc: PmNode): PmNode {
  let hasMarks = false;
  doc.descendants((node) => {
    hasMarks ||= isInlineAtom(node) && node.marks.length > 0;
    return !hasMarks;
  });
  if (!hasMarks) return doc;
  // Recursive, so a paragraph in a box (v4) is cleaned like a top-level one.
  const clean = (node: PmNode): PmNode => {
    if (isInlineAtom(node)) return node.mark([]);
    if (node.isLeaf) return node;
    const children: PmNode[] = [];
    node.forEach((child) => children.push(clean(child)));
    return node.copy(Fragment.from(children));
  };
  return clean(doc);
}

/** Converts slice atoms between canonical step JSON and ProseMirror JSON. */
export function mapStepAtoms(schema: Schema, value: unknown, toPm: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => mapStepAtoms(schema, item, toPm));
  if (typeof value !== "object" || value === null) return value;
  const object = value as Record<string, unknown>;
  const node = typeof object.type === "string" ? schema.nodes[object.type] : undefined;
  // Inline atoms (v2 and later) and atom blocks (v4): document form <-> ProseMirror form.
  if (node?.isAtom && !node.isText && (node.isInline || Object.hasOwn(object, "nodeId") || Object.hasOwn(object, "attrs"))) {
    if (toPm) {
      const attrs = Object.fromEntries(Object.keys(node.spec.attrs ?? {}).map((key) => [key, object[key] ?? null]));
      return { type: object.type, attrs };
    }
    if (object.marks !== undefined || object.content !== undefined) refuse("invalid_atom");
    // An atom block always names its id, `null` while it has none.
    const attrs = Object.entries(object.attrs as Record<string, unknown>).filter(
      ([key, value]) => value !== null || (!node.isInline && key === "nodeId"),
    );
    return { ...Object.fromEntries(attrs), type: object.type };
  }
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, mapStepAtoms(schema, item, toPm)]));
}

async function applySourceStep(
  doc: PmNode,
  step: Extract<EditStepV3, { stepType: "sourceSet" | "sourceRemove" }>,
): Promise<PmNode> {
  const sources = doc.attrs.sources as readonly DocumentSource[];
  const id = step.stepType === "sourceSet" ? step.source.id : step.sourceId;
  const index = sources.findIndex((source) => source.id === id);
  let next: readonly DocumentSource[];
  if (index < 0) {
    if (step.stepType === "sourceRemove" || "removedSha256" in step || sources.length >= MAX_DOCUMENT_SOURCES) {
      refuse("invalid_source_change");
    }
    next = [...sources, step.source];
  } else {
    const old = canonicalizeJcs(sources[index]);
    if (await sha256WebCrypto(old) !== step.removedSha256) refuse("removed_range_hash");
    if (step.stepType === "sourceSet" && canonicalizeJcs(step.source) === old) refuse("step_changes_nothing");
    next = step.stepType === "sourceRemove"
      ? sources.filter((_, i) => i !== index)
      : sources.map((source, i) => i === index ? step.source : source);
  }
  return doc.type.create({ ...doc.attrs, sources: next }, doc.content);
}

function noNewId(): never {
  return refuse("block_identity");
}

/** Contract v4 §9, point 7: the cover is set whole, or removed, and the old one's hash is checked. */
async function applyCoverStep(doc: PmNode, step: Extract<EditStepV4, { stepType: "coverSet" }>): Promise<PmNode> {
  const old: unknown = doc.attrs.cover;
  if (old === null || old === undefined) {
    if (step.removedSha256 !== undefined || step.cover === undefined) refuse("invalid_cover_change");
  } else {
    if (step.removedSha256 === undefined) refuse("invalid_cover_change");
    const canonical = coverCanonical(old);
    if (await sha256WebCrypto(canonical) !== step.removedSha256) refuse("removed_range_hash");
    if (step.cover !== undefined && canonicalizeJcs(step.cover as JcsJsonValue) === canonical) refuse("step_changes_nothing");
  }
  return doc.type.create({ ...doc.attrs, cover: step.cover ?? null }, doc.content);
}

export function createBrowserAcademicReplayer(version: AcademicSchemaVersion): AsyncEvidenceStepReplayerV2<PmNode> {
  const schema = replaySchema(version);
  const transactionFormat = academicStepFormat[version];
  return {
    transactionFormat,
    load(canonical) {
      let json: Record<string, unknown>;
      if (version === 4) {
        const valid = validateDocumentV4(canonical);
        if (!valid.ok) refuse("invalid_document");
        json = canonicalToTiptapV4(valid.doc);
      } else {
        const valid = validateVersionedDocument(canonical);
        if (!valid.ok || valid.doc.schemaVersion !== version) refuse("invalid_document");
        json = valid.doc.schemaVersion === 3 ? canonicalToTiptapV3(valid.doc) : canonicalToTiptapV2(valid.doc);
      }
      const doc = schema.nodeFromJSON(json);
      doc.check();
      return doc;
    },
    async apply(doc, event) {
      const parsed = parseEditSteps(transactionFormat, event.steps) as
        | { ok: true; steps: EditStepV4[] }
        | { ok: false; code: string };
      if (!parsed.ok) {
        if (namesUnknownType(event.steps, schema)) throw new EvidenceContentNotSupportedV2(parsed.code);
        refuse(parsed.code);
      }
      for (const step of parsed.steps) {
        if (step.stepType === "sourceSet" || step.stepType === "sourceRemove") {
          doc = await applySourceStep(doc, step as Extract<EditStepV3, { stepType: "sourceSet" | "sourceRemove" }>);
          continue;
        }
        if (step.stepType === "coverSet") {
          doc = await applyCoverStep(doc, step);
          continue;
        }
        const checks = version === 4 ? checkContentStepV4(doc, step) : checkContentStep(doc, step as never);
        for (const claim of checks) {
          if (await sha256WebCrypto(claim.canonical) !== claim.recorded) refuse("removed_range_hash");
        }
        const json: Record<string, unknown> = { ...step };
        delete json.removedSha256;
        if ("slice" in json) json.slice = mapStepAtoms(schema, json.slice, true);
        doc = unmarkInlineAtoms(applyPmStep(doc, json));
        doc.check();
      }
      return doc;
    },
    toCanonical(doc) {
      if (version === 4) {
        // Obligation 4 at any depth: every block, atoms and box paragraphs included, has its own id.
        checkBlockIdentity(doc);
        const candidate = tiptapToCanonicalV4(doc.toJSON(), noNewId);
        if (!candidate.ok) refuse("invalid_document");
        if (!doc.eq(schema.nodeFromJSON(canonicalToTiptapV4(candidate.doc)))) refuse("invalid_document");
        return candidate.doc as unknown as JcsJsonValue;
      }
      const candidate = version === 3
        ? tiptapToCanonicalV3(doc.toJSON(), noNewId)
        : tiptapToCanonicalV2(doc.toJSON(), noNewId);
      if (!candidate.ok) refuse("invalid_document");
      const json = candidate.doc.schemaVersion === 3
        ? canonicalToTiptapV3(candidate.doc)
        : canonicalToTiptapV2(candidate.doc);
      if (!doc.eq(schema.nodeFromJSON(json))) refuse("invalid_document");
      return candidate.doc as unknown as JcsJsonValue;
    },
  };
}
