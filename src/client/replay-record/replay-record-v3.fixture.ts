import { getSchema } from "@tiptap/core";
import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import { EditorState, type Transaction } from "@tiptap/pm/state";

import { REVISION_ZERO_V3_JCS, revisionZeroDocumentV3 } from "@/domain/document/revision-zero";
import { EvidenceRecorder, changeOf } from "../../../packages/editor-core/src/editor/capture";
import { canonicalToTiptapV3 } from "../../../packages/editor-core/src/editor/interop-v3";
import { createEditorExtensionsV3 } from "../../../packages/editor-core/src/editor/schema";
import { sha256WebCrypto } from "@/domain/forensics/crypto";

/**
 * Synthetic replay records of a work of document v3 (INT-23): invented ids,
 * an invented source and filler text, no real work or person. Each segment is
 * written by the editor's own recorder of v3, exactly as capture writes it, so
 * its steps are `ductus-edit-steps-v3` and its first document is the v3
 * revision 0.
 */

export const V3_DOCUMENT_ID = "rad-izmisljeni-v3";
export const V3_SOURCE = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", type: "book", title: "Izmišljeni izvor", year: 2021,
  authors: [{ kind: "person", family: "Izmišljenić", given: "Ana" }], place: "Zagreb", publisher: "Izmišljeni nakladnik",
} as const;

export const v3Schema: Schema = getSchema(createEditorExtensionsV3());
export const v3Start: PmNode = v3Schema.nodeFromJSON(canonicalToTiptapV3(revisionZeroDocumentV3()));
export const V3_START_JCS = REVISION_ZERO_V3_JCS;

/** One event: the transaction made from the document as it stands. */
export type V3Edit = (state: EditorState) => Transaction;

const BASE = Date.parse("2026-10-20T10:00:00.000Z");

/** A record of one segment per entry of `plans`: events a second apart, segments a minute apart. */
export async function buildRecordV3(plans: V3Edit[][]) {
  let state = EditorState.create({ schema: v3Schema, doc: v3Start });
  const segments: string[] = [];
  const hashes: string[] = [];
  const ends: PmNode[] = [];
  let sequence = 1;
  let at = BASE;
  for (const [index, events] of plans.entries()) {
    // Each segment from its own recorder, so its events are exactly these.
    const recorder = new EvidenceRecorder(undefined, 3);
    for (const edit of events) {
      const tr = edit(state);
      state = state.apply(tr);
      recorder.record(changeOf([tr], "editor", at));
      at += 1_000;
      recorder.close();
    }
    const built = await recorder.takeSegment({
      documentId: V3_DOCUMENT_ID,
      sessionId: "sesija-izmisljena",
      segmentId: `segment-v3-${index + 1}`,
      evidenceProfileId: "standard-v1",
      sequenceFrom: sequence,
      predecessorSegmentHash: hashes.at(-1) ?? null,
    });
    if (built === null || recorder.pendingEvents !== 0) throw new Error("fixture: one segment per plan");
    sequence = built.segment.sequenceTo + 1;
    at += 60_000;
    const text = new TextDecoder().decode(built.bytes);
    segments.push(text);
    hashes.push(await sha256WebCrypto(text));
    ends.push(state.doc);
  }
  return { segments, hashes, ends, head: hashes.length ? { segmentHash: hashes.at(-1)!, segmentCount: hashes.length } : null };
}

/** The source set and cited, then a footnote, as one event: the steps the v3 editor records. */
export const citeAndFootnote: V3Edit = (state) =>
  state.tr.setDocAttribute("sources", [V3_SOURCE])
    .insert(1, v3Schema.nodes.citation!.create({ sourceId: V3_SOURCE.id, locator: "7" }))
    .insert(2, v3Schema.nodes.footnote!.create({ text: "Izmišljena bilješka." }));

export const typeAt = (pos: number, value: string): V3Edit => (state) => state.tr.insertText(value, pos);
