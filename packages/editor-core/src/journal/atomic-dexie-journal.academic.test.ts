import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";

import {
  REVISION_ZERO_V2_JCS, REVISION_ZERO_V2_SHA256, REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256,
  revisionZeroDocumentV3,
} from "../document/document/revision-zero";
import { verifyEvidenceChainV2 } from "../document/forensics/evidence-chain-v2";
import { EvidenceRecorder, changeOf } from "../editor/capture";
import { canonicalToTiptapV3 } from "../editor/interop-v3";
import { createEditorExtensionsV3 } from "../editor/schema";
import { verifyWorkOpening } from "../serverSync/work-opening";
import type { EvidenceOpening } from "../sync/journal-types";
import { DOC, PROFILE, UTC, journalKit } from "../sync/runner/evidence-test-kit";

const kit = journalKit("f");
afterEach(kit.cleanup);

function opening(text: string, documentHash: string): EvidenceOpening {
  return {
    documentId: DOC, currentRevision: 0, document: new TextEncoder().encode(text), documentHash,
    headSegmentHash: null, lastSequenceTo: 0, evidenceProfileId: PROFILE,
  };
}

describe("atomic journal for an academic work", () => {
  it("starts and stores v3 only for the verified work and refuses to switch an existing v2 work", async () => {
    const v2 = opening(REVISION_ZERO_V2_JCS, REVISION_ZERO_V2_SHA256);
    const v3 = opening(REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256);
    const workV2 = (await verifyWorkOpening(DOC, v2))!;
    const workV3 = (await verifyWorkOpening(DOC, v3))!;
    const old = kit.open();
    await old.startEvidence(DOC, v2, UTC, workV2);
    await expect(old.startEvidence(DOC, v3, UTC, workV3)).rejects.toMatchObject({ code: "invalid_input" });
    expect((await old.readEvidence(DOC, workV2)).snapshot?.document.schemaVersion).toBe(2);

    const journal = kit.open();
    await expect(journal.startEvidence(DOC, v3, UTC)).rejects.toMatchObject({ code: "invalid_input" });
    await journal.startEvidence(DOC, v3, UTC, workV3);
    const schema = getSchema(createEditorExtensionsV3());
    const doc = schema.nodeFromJSON(canonicalToTiptapV3(revisionZeroDocumentV3()));
    const recorder = new EvidenceRecorder(undefined, 3);
    const change = EditorState.create({ doc }).tr.insert(1, schema.nodes.footnote!.create({ text: "Izmišljena bilješka" }));
    recorder.record(changeOf([change], "editor", Date.parse(UTC)));
    recorder.close();
    const segment = (await recorder.takeSegment({
      documentId: DOC, sessionId: "sesija-izmisljena", segmentId: "segment-izmisljeni",
      evidenceProfileId: PROFILE, sequenceFrom: 1, predecessorSegmentHash: null,
    }))!;
    await expect(journal.saveSegment(DOC, segment, UTC, 0)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(journal.saveSegment(DOC, segment, UTC, 0, workV2)).rejects.toMatchObject({ code: "invalid_input" });
    expect((await journal.readEvidence(DOC, workV3)).pending).toEqual([]);
    await journal.saveSegment(DOC, segment, UTC, 0, workV3);
    const stored = await journal.readEvidence(DOC, workV3);
    expect(stored.snapshot?.document).toMatchObject({ schemaVersion: 3, nodes: [{ children: [{ type: "footnote", text: "Izmišljena bilješka" }] }] });
    expect(stored.pending).toMatchObject([{ tx: { segmentHash: segment.sha256 } }]);
    const head = { segmentHash: segment.sha256, segmentCount: 1 };
    const storedPayloads = stored.pending.map((row) => row.tx.segment);
    expect(await verifyEvidenceChainV2(storedPayloads, head, workV3.transactionFormat)).toMatchObject({ ok: true, head });
    expect(await verifyEvidenceChainV2(storedPayloads, head, workV2.transactionFormat)).toMatchObject({ ok: false, reason: "invalid_segment" });
    await expect(journal.readEvidence(DOC)).rejects.toMatchObject({ code: "invalid_input" });
  });
});
