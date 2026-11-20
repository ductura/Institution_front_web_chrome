import { getSchema } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { EDIT_STEP_FORMAT_V2, EDIT_STEP_FORMAT_V3 } from "../document/document/edit-step";
import { REVISION_ZERO_V3_SHA256, revisionZeroDocumentV2, revisionZeroDocumentV3 } from "../document/document/revision-zero";
import { verifyCanonicalEvidencePayloadV2 } from "../document/forensics/evidence-chain-v2";
import { replayEvidenceSegmentsV2 } from "../document/forensics/evidence-replay-v2";
import type { JcsJsonValue } from "../document/forensics/jcs";
import { createBrowserAcademicReplayer } from "../document/forensics/replay/edit-steps-versioned-browser-replayer";
import { EvidenceRecorder, changeOf } from "./capture";
import { canonicalToTiptapV2 } from "./interop-v2";
import { canonicalToTiptapV3 } from "./interop-v3";
import { createEditorExtensionsV2, createEditorExtensionsV3 } from "./schema";

const context = {
  documentId: "rad-izmisljeni", sessionId: "sesija-izmisljena", segmentId: "segment-izmisljeni",
  evidenceProfileId: "profil-izmisljeni", sequenceFrom: 1, predecessorSegmentHash: null,
};
const source = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "book", title: "Izvor 1", year: 2020,
  authors: [{ kind: "person", family: "Prezime", given: "Ime" }], place: "Zagreb", publisher: "Nakladnik",
};

describe("capture by work document version", () => {
  it("captures a source, a citation and a footnote atom edit and replays their exact bytes in v3", async () => {
    const zero = revisionZeroDocumentV3();
    const schema = getSchema(createEditorExtensionsV3());
    let state = EditorState.create({ schema, doc: schema.nodeFromJSON(canonicalToTiptapV3(zero)) });
    const recorder = new EvidenceRecorder(undefined, 3);
    const record = (tr: Transaction, at: number) => {
      state = state.apply(tr);
      recorder.record(changeOf([tr], "editor", at));
    };
    record(state.tr.setDocAttribute("sources", [source])
      .insert(1, schema.nodes.citation!.create({ sourceId: source.id, locator: "12", via: "Izmišljeni, 1973" }))
      .insert(2, schema.nodes.footnote!.create({ text: "Izmišljena bilješka" })), 0);
    record(state.tr.setNodeMarkup(2, undefined, { text: "Nova bilješka" }), 1);
    recorder.close();
    const built = (await recorder.takeSegment(context))!;
    expect(built.segment.initialDocumentHash).toBe(REVISION_ZERO_V3_SHA256);
    expect(built.segment.captureContext.transactionFormat).toBe(EDIT_STEP_FORMAT_V3);
    expect(built.segment.events[0]!.steps).toMatchObject([
      { stepType: "sourceSet", source },
      { stepType: "replace", slice: { content: [{ type: "citation", sourceId: source.id, locator: "12", via: "Izmišljeni, 1973" }] } },
      { stepType: "replace", slice: { content: [{ type: "footnote", text: "Izmišljena bilješka" }] } },
      { stepType: "replace", from: 2, to: 3, removedSha256: expect.stringMatching(/^[0-9a-f]{64}$/u) },
    ]);
    expect(await verifyCanonicalEvidencePayloadV2(built.bytes, EDIT_STEP_FORMAT_V2)).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyCanonicalEvidencePayloadV2(built.bytes, EDIT_STEP_FORMAT_V3)).toMatchObject({ ok: true });
    expect(await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [built.segment], createBrowserAcademicReplayer(3)))
      .toEqual({ ok: true, canonicalDocument: new TextDecoder().decode(built.document), documentSha256: built.segment.finalDocumentHash });
  });

  it("captures a v2 work using only v2 fields and matches v2 replay", async () => {
    const zero = revisionZeroDocumentV2();
    const schema = getSchema(createEditorExtensionsV2());
    const state = EditorState.create({ schema, doc: schema.nodeFromJSON(canonicalToTiptapV2(zero)) });
    const recorder = new EvidenceRecorder(undefined, 2);
    recorder.record(changeOf([state.tr.insertText("Izmišljeni tekst", 1)], "editor", 0));
    recorder.close();
    const built = (await recorder.takeSegment(context))!;
    expect(built.segment.captureContext.transactionFormat).toBe(EDIT_STEP_FORMAT_V2);
    expect(await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [built.segment], createBrowserAcademicReplayer(2)))
      .toMatchObject({ ok: true, canonicalDocument: new TextDecoder().decode(built.document) });
  });
});
