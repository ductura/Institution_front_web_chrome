import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it, vi } from "vitest";

import {
  REVISION_ZERO_V2_JCS, REVISION_ZERO_V2_SHA256, REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256,
  revisionZeroDocumentV3,
} from "../document/document/revision-zero";
import { sha256WebCrypto } from "../document/forensics/crypto";
import { EvidenceRecorder, changeOf } from "../editor/capture";
import { canonicalToTiptapV3 } from "../editor/interop-v3";
import { createEditorExtensionsV3 } from "../editor/schema";
import type { EvidenceOpening } from "../sync/journal-types";
import { createEvidenceTransport } from "../sync/runner/evidence-transport";
import { matchesWorkOpening, verifyWorkOpening } from "./work-opening";

const documentId = "rad-izmisljeni";
const profile = "profil-izmisljeni";
const proof = { documentId, sha256: REVISION_ZERO_V3_SHA256 };

function opening(jcs: string, documentHash: string): EvidenceOpening {
  return {
    documentId, documentHash, document: new TextEncoder().encode(jcs), currentRevision: 0,
    headSegmentHash: null, lastSequenceTo: 0, evidenceProfileId: profile,
  };
}

describe("work opening schema verification", () => {
  it("selects v3 only on the exact revision zero response and keeps v2 in its format", async () => {
    const v2 = opening(REVISION_ZERO_V2_JCS, REVISION_ZERO_V2_SHA256);
    const v3 = opening(REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256);
    expect(await verifyWorkOpening(documentId, v2)).toMatchObject({ schemaVersion: 2, transactionFormat: "ductus-edit-steps-v2" });
    expect(await verifyWorkOpening(documentId, v3)).toMatchObject({ schemaVersion: 3, transactionFormat: "ductus-edit-steps-v3" });
    expect(await verifyWorkOpening("drugi-rad", v3)).toBeNull();
    expect(await verifyWorkOpening(documentId, v2, proof)).toBeNull();
    expect(await verifyWorkOpening(documentId, { ...v3, documentHash: REVISION_ZERO_V2_SHA256 })).toBeNull();
    expect(await verifyWorkOpening(documentId, { ...v3, lastSequenceTo: 1 })).toBeNull();
  });

  it("requires the same work's revision zero proof when reopening a later v3 revision", async () => {
    const text = REVISION_ZERO_V3_JCS.replace('"children":[]', '"children":[{"marks":[],"text":"Izmišljeni tekst","type":"text"}]');
    const latest = { ...opening(text, await sha256WebCrypto(text)), currentRevision: 1 };
    expect(await verifyWorkOpening(documentId, { ...latest, currentRevision: 0 }, proof)).toBeNull();
    expect(await verifyWorkOpening(documentId, latest)).toBeNull();
    expect(await verifyWorkOpening(documentId, latest, { ...proof, documentId: "drugi-rad" })).toBeNull();
    expect(await verifyWorkOpening(documentId, latest, proof)).toMatchObject({ schemaVersion: 3, revision: 1 });
  });

  it("blocks a queued v3 write before the request when its work only confirmed v2", async () => {
    const schema = getSchema(createEditorExtensionsV3());
    const doc = schema.nodeFromJSON(canonicalToTiptapV3(revisionZeroDocumentV3()));
    const recorder = new EvidenceRecorder(undefined, 3);
    recorder.record(changeOf([EditorState.create({ doc }).tr.insertText("Izmišljeni tekst", 1)], "editor", 0));
    recorder.close();
    const segment = (await recorder.takeSegment({
      documentId, evidenceProfileId: profile, sessionId: "sesija-izmisljena", segmentId: "segment-izmisljeni",
      sequenceFrom: 1, predecessorSegmentHash: null,
    }))!;
    const tx = {
      kind: "EVIDENCE_SEGMENT" as const, clientTransactionId: `seg-${segment.sha256}`, baseRevision: 0,
      segment: segment.bytes, segmentHash: segment.sha256, document: segment.document, sequenceFrom: 1, sequenceTo: 1,
      createdAt: "2026-11-20T00:00:00.000Z",
    };
    const v2 = (await verifyWorkOpening(documentId, opening(REVISION_ZERO_V2_JCS, REVISION_ZERO_V2_SHA256)))!;
    const v3 = (await verifyWorkOpening(documentId, opening(REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256)))!;
    expect(await matchesWorkOpening(v3, documentId, tx)).toBe(true);
    expect(await matchesWorkOpening(v3, "drugi-rad", tx)).toBe(false);
    expect(await matchesWorkOpening(v3, documentId, { ...tx, document: opening(REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256).document })).toBe(false);
    const fetch = vi.fn<typeof globalThis.fetch>();
    const transport = createEvidenceTransport(fetch, undefined, v2);
    await expect(transport(documentId, tx)).resolves.toEqual({ status: "invalid_document" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
