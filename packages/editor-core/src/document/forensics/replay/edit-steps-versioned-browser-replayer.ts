import { getSchema } from "@tiptap/core";
import { Fragment, type Node as PmNode, type Schema } from "@tiptap/pm/model";

import { createEditorExtensionsV2, createEditorExtensionsV3 } from "../../../editor/schema";
import { canonicalToTiptapV2, tiptapToCanonicalV2 } from "../../../editor/interop-v2";
import { canonicalToTiptapV3, tiptapToCanonicalV3 } from "../../../editor/interop-v3";
import { validateVersionedDocument } from "../../document";
import { EDIT_STEP_FORMAT_V2, EDIT_STEP_FORMAT_V3, parseEditSteps, type EditStepV3 } from "../../document/edit-step";
import { MAX_DOCUMENT_SOURCES, type DocumentSource } from "../../document/schema";
import { sha256WebCrypto } from "../crypto";
import { EvidenceContentNotSupportedV2, type AsyncEvidenceStepReplayerV2 } from "../evidence-replay-v2";
import { canonicalizeJcs, type JcsJsonValue } from "../jcs";
import { applyPmStep, checkContentStep, namesUnknownType, refuse } from "./edit-steps-v1-rules";

export type AcademicSchemaVersion = 2 | 3;
export const academicStepFormat = { 2: EDIT_STEP_FORMAT_V2, 3: EDIT_STEP_FORMAT_V3 } as const;

const schemas = new Map<AcademicSchemaVersion, Schema>();

function replaySchema(version: AcademicSchemaVersion): Schema {
  const cached = schemas.get(version);
  if (cached) return cached;
  const schema = getSchema(version === 3 ? createEditorExtensionsV3() : createEditorExtensionsV2());
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
  const blocks: PmNode[] = [];
  doc.forEach((block) => {
    const inline: PmNode[] = [];
    block.forEach((child) => inline.push(isInlineAtom(child) ? child.mark([]) : child));
    blocks.push(block.copy(Fragment.from(inline)));
  });
  return doc.copy(Fragment.from(blocks));
}

/** Converts slice atoms between canonical step JSON and ProseMirror JSON. */
export function mapStepAtoms(schema: Schema, value: unknown, toPm: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => mapStepAtoms(schema, item, toPm));
  if (typeof value !== "object" || value === null) return value;
  const object = value as Record<string, unknown>;
  const node = typeof object.type === "string" ? schema.nodes[object.type] : undefined;
  if (node?.isInline && node.isAtom && !node.isText) {
    if (toPm) {
      const attrs = Object.fromEntries(Object.keys(node.spec.attrs ?? {}).map((key) => [key, object[key] ?? null]));
      return { type: object.type, attrs };
    }
    if (object.marks !== undefined || object.content !== undefined) refuse("invalid_atom");
    const attrs = Object.entries(object.attrs as Record<string, unknown>).filter(([, value]) => value !== null);
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

export function createBrowserAcademicReplayer(version: AcademicSchemaVersion): AsyncEvidenceStepReplayerV2<PmNode> {
  const schema = replaySchema(version);
  const transactionFormat = academicStepFormat[version];
  return {
    transactionFormat,
    load(canonical) {
      const valid = validateVersionedDocument(canonical);
      if (!valid.ok || valid.doc.schemaVersion !== version) refuse("invalid_document");
      const json = valid.doc.schemaVersion === 3 ? canonicalToTiptapV3(valid.doc) : canonicalToTiptapV2(valid.doc);
      const doc = schema.nodeFromJSON(json);
      doc.check();
      return doc;
    },
    async apply(doc, event) {
      const parsed = parseEditSteps(transactionFormat, event.steps);
      if (!parsed.ok) {
        if (namesUnknownType(event.steps, schema)) throw new EvidenceContentNotSupportedV2(parsed.code);
        refuse(parsed.code);
      }
      for (const step of parsed.steps) {
        if (step.stepType === "sourceSet" || step.stepType === "sourceRemove") {
          doc = await applySourceStep(doc, step);
          continue;
        }
        for (const claim of checkContentStep(doc, step)) {
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
