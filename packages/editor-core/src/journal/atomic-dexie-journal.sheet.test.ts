// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { replayEvidenceSegmentsV2 } from "../document/forensics/evidence-replay-v2";
import { verifyCanonicalEvidencePayloadV2 } from "../document/forensics/evidence-chain-v2";
import type { JcsJsonValue } from "../document/forensics/jcs";
import { createSheetReplayer, SheetCaptureError, SheetRecorder } from "../serverSync/sheet-sync";
import { SheetSaver } from "./sheet-saver";
import { resolveInitialSheet } from "../serverSync/bootstrap";
import { verifyWorkOpening } from "../serverSync/work-opening";
import {
  SHEET_REVISION_ZERO_SHA256, SHEET_STEP_FORMAT_V1, sheetCellSha256, sheetRevisionZeroDocument, sheetSnapshotBytes,
  type SheetStep,
} from "../sheet/steps";
import type { EvidenceOpening } from "../sync/journal-types";
import { DOC, journalKit, PROFILE, sha256, UTC } from "../sync/runner/evidence-test-kit";

/** WEB-V14-SHEET-JOURNAL: the journal holds a spreadsheet work the way it holds a text one. Invented data. */
const kit = journalKit("c");
afterEach(kit.cleanup);

const S = "00000000-0000-4000-8000-000000000000";
const zero = sheetRevisionZeroDocument();
const a1: SheetStep = { type: "cellSet", sheetId: S, ref: "A1", value: 7 };
const b1: SheetStep = { type: "cellSet", sheetId: S, ref: "B1", value: 5 };
const context = (over = {}) => ({
  documentId: DOC, sessionId: "sjednica-1", segmentId: "segment-1", evidenceProfileId: PROFILE,
  sequenceFrom: 1, predecessorSegmentHash: null, ...over,
});

function zeroOpening(over: Partial<EvidenceOpening> = {}): EvidenceOpening & { documentKind: "spreadsheet" } {
  const document = sheetSnapshotBytes(zero);
  return {
    documentId: DOC, currentRevision: 0, documentHash: sha256(document), headSegmentHash: null,
    lastSequenceTo: 0, document, evidenceProfileId: PROFILE, documentKind: "spreadsheet", ...over,
  };
}

async function started() {
  const opened = zeroOpening();
  const work = (await verifyWorkOpening(DOC, opened))!;
  const journal = kit.open();
  await journal.startEvidence(DOC, opened, UTC, work);
  return { journal, work, opened };
}

describe("a spreadsheet work in the journal", () => {
  it("verifies revision zero and refuses anything else as revision zero", async () => {
    const work = await verifyWorkOpening(DOC, zeroOpening());
    expect(work?.documentKind).toBe("spreadsheet");
    expect(work?.snapshotSha256).toBe(SHEET_REVISION_ZERO_SHA256);
    const other = structuredClone(zero);
    other.sheets[0]!.name = "Drugi";
    const bytes = sheetSnapshotBytes(other);
    expect(await verifyWorkOpening(DOC, zeroOpening({ document: bytes, documentHash: sha256(bytes) }))).toBeNull();
    expect(await verifyWorkOpening(DOC, zeroOpening({ documentHash: "0".repeat(64) }))).toBeNull();
    expect(await verifyWorkOpening("tudji-rad", zeroOpening())).toBeNull();
    expect(await verifyWorkOpening(DOC, zeroOpening(), { documentId: DOC, sha256: "f".repeat(64) })).toBeNull();
  });

  it("records steps, saves the segment, replays it and keeps the chain", async () => {
    const { journal, work } = await started();
    const recorder = new SheetRecorder(zero);
    await recorder.record({ steps: [a1], source: "unattributed", at: Date.parse(UTC) });
    recorder.close();
    const built = (await recorder.takeSegment(context()))!;
    expect(built.segment.captureContext.transactionFormat).toBe(SHEET_STEP_FORMAT_V1);
    expect((await verifyCanonicalEvidencePayloadV2(built.bytes, SHEET_STEP_FORMAT_V1)).ok).toBe(true);
    // A text reader refuses the same bytes.
    expect((await verifyCanonicalEvidencePayloadV2(built.bytes)).ok).toBe(false);
    const replay = await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [built.segment], createSheetReplayer());
    expect(replay.ok && replay.documentSha256).toBe(built.segment.finalDocumentHash);

    const saved = await journal.saveSegment(DOC, built, UTC, 0, work);
    expect(saved.meta.state).toBe("LOCAL_DURABLE");
    const contents = await journal.readEvidence(DOC, work);
    expect(contents.pending).toHaveLength(1);
    expect((contents.snapshot!.document as unknown as { kind: string }).kind).toBe("spreadsheet");
    // The text reader never takes a sheet snapshot.
    await expect(journal.readEvidence(DOC)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(journal.read(DOC)).rejects.toMatchObject({ code: "invalid_input" });
    expect((await journal.readVerifiedWork(DOC))?.documentKind).toBe("spreadsheet");
  });

  it("refuses a segment whose document is not the sheet it ends in", async () => {
    const { journal, work } = await started();
    const recorder = new SheetRecorder(zero);
    await recorder.record({ steps: [a1], source: "unattributed", at: Date.parse(UTC) });
    recorder.close();
    const built = (await recorder.takeSegment(context()))!;
    const wrong = { ...built, document: sheetSnapshotBytes(zero) };
    await expect(journal.saveSegment(DOC, wrong, UTC, 0, work)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("stops the recorder at a change the replayer would refuse, and ignores a no-op", async () => {
    const recorder = new SheetRecorder(zero);
    await recorder.record({ steps: [], source: "unattributed", at: 1 });
    expect(recorder.pendingEvents).toBe(0);
    const bad: SheetStep = { type: "cellSet", sheetId: "11111111-1111-4111-8111-111111111111", ref: "A1", value: 1 };
    await expect(recorder.record({ steps: [bad], source: "unattributed", at: 2 })).rejects.toBeInstanceOf(SheetCaptureError);
    expect(recorder.intact).toBe(false);
    await expect(recorder.record({ steps: [a1], source: "unattributed", at: 3 })).rejects.toBeInstanceOf(SheetCaptureError);
    // A step with a time field is not a step of the format.
    const fresh = new SheetRecorder(zero);
    await expect(fresh.record({ steps: [{ ...a1, time: 1 } as unknown as SheetStep], source: "unattributed", at: 1 }))
      .rejects.toMatchObject({ code: "unsupported_step" });
  });

  it("merges changes within the quiet time into one event and splits on a pause, keeping order", async () => {
    const recorder = new SheetRecorder(zero);
    const t = Date.parse(UTC);
    await recorder.record({ steps: [a1], source: "unattributed", at: t });
    await recorder.record({ steps: [b1], source: "unattributed", at: t + 100 });
    const replaced = await sheetCellSha256({ value: 7 } as never);
    await recorder.record({ steps: [{ ...a1, value: 9, replacedSha256: replaced }], source: "unattributed", at: t + 5000 });
    recorder.close();
    const built = (await recorder.takeSegment(context()))!;
    expect(built.eventCount).toBe(2);
    expect(built.timing.events[0]!.stepOffsetsMs).toEqual([0, 100]);
    const replay = await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [built.segment], createSheetReplayer());
    expect(replay.ok).toBe(true);
    // The same steps in the other order do not replay (the replaced hash no longer fits).
    const swapped = { ...built.segment, events: [built.segment.events[1]!, built.segment.events[0]!] } as never;
    expect((await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [swapped], createSheetReplayer())).ok).toBe(false);
  });

  it("leaves nothing of a spreadsheet work after logout", async () => {
    const scope = kit.nextScope();
    const opened = zeroOpening();
    const work = (await verifyWorkOpening(DOC, opened))!;
    const journal = kit.open(scope);
    await journal.startEvidence(DOC, opened, UTC, work);
    expect((await journal.readEvidence(DOC, work)).snapshot).not.toBeNull();
    await journal.destroyForLogout();
    const after = kit.open(scope);
    expect((await after.readEvidence(DOC, work)).snapshot).toBeNull();
    expect(await after.readVerifiedWork(DOC)).toBeNull();
  });
});

describe("SheetSaver", () => {
  const saverFor = async (over: { journal?: Awaited<ReturnType<typeof started>>["journal"] } = {}) => {
    const { journal, work } = await started();
    let n = 0;
    const saver = new SheetSaver(over.journal ?? journal, DOC, work, { newId: () => `id-${(n += 1)}` });
    return { saver, journal, work };
  };

  it("saves edits offline as chained segments, and a reopened work gives the same document", async () => {
    const { saver, journal, work } = await saverFor();
    const loaded = await saver.load();
    expect(loaded.kind).toBe("ready");
    const doc1 = structuredClone(zero);
    doc1.sheets[0]!.cells.A1 = { value: 7 } as never;
    await saver.edit({ steps: [a1], at: Date.parse(UTC), document: doc1 });
    await saver.flush();
    const doc2 = structuredClone(doc1);
    doc2.sheets[0]!.cells.B1 = { value: 5 } as never;
    await saver.edit({ steps: [b1], at: Date.parse(UTC) + 10_000, document: doc2 });
    await saver.flush();
    expect(saver.snapshot().state).toBe("LOCAL_DURABLE");
    const contents = await journal.readEvidence(DOC, work);
    expect(contents.pending.map((p) => p.tx.sequenceFrom)).toEqual([1, 2]);
    const second = JSON.parse(new TextDecoder().decode(contents.pending[1]!.tx.segment)) as { predecessorSegmentHash: string | null };
    expect(second.predecessorSegmentHash).toBe(contents.pending[0]!.tx.segmentHash);
    // Reopen: a new saver over the same journal starts from the same document.
    const again = new SheetSaver(journal, DOC, work);
    const reopened = await again.load();
    expect(reopened.kind === "ready" && reopened.document.sheets[0]!.cells).toEqual(doc2.sheets[0]!.cells);
  });

  it("an unreadable step stops evidence, keeps the document and never claims SYNCED", async () => {
    const { saver, journal, work } = await saverFor();
    await saver.load();
    const doc = structuredClone(zero);
    doc.sheets[0]!.cells.A1 = { value: 1 } as never;
    const bad = { type: "cellSet", sheetId: S, ref: "A1", value: 1, time: 5 } as unknown as SheetStep;
    await saver.edit({ steps: [bad], document: doc });
    expect(saver.snapshot().failure).toEqual({ kind: "evidence_stopped", reason: "unsupported_step" });
    expect(saver.snapshot().state).not.toBe("SYNCED");
    const contents = await journal.readEvidence(DOC, work);
    expect(contents.pending).toHaveLength(0);
    expect(contents.meta?.evidenceStopped).toBe("unsupported_step");
    expect((contents.snapshot!.document as unknown as { sheets: { cells: object }[] }).sheets[0]!.cells).toHaveProperty("A1");
  });

  it("writes events closed before a stop, then keeps saving the document uncovered", async () => {
    const { saver, journal, work } = await saverFor();
    await saver.load();
    const t = Date.parse(UTC);
    const d1 = structuredClone(zero);
    d1.sheets[0]!.cells.A1 = { value: 7 } as never;
    await saver.edit({ steps: [a1], at: t, document: d1 });
    const d2 = structuredClone(d1);
    d2.sheets[0]!.cells.B1 = { value: 5 } as never;
    // A pause closes the first event; the unreadable step then stops the recorder.
    await saver.edit({ steps: [b1], at: t + 5000, document: d2 });
    const bad = { type: "cellSet", sheetId: S, ref: "C1", value: 1, time: 5 } as unknown as SheetStep;
    const d3 = structuredClone(d2);
    d3.sheets[0]!.cells.C1 = { value: 1 } as never;
    await saver.edit({ steps: [bad], at: t + 10_000, document: d3 });
    await saver.flush();
    expect(saver.snapshot().failure).toEqual({ kind: "evidence_stopped", reason: "unsupported_step" });
    let contents = await journal.readEvidence(DOC, work);
    expect(contents.pending).toHaveLength(1);
    // A later edit is still saved, not dropped by a journal failure.
    const d4 = structuredClone(d3);
    d4.sheets[0]!.cells.D1 = { value: 2 } as never;
    await saver.edit({ steps: [a1], at: t + 20_000, document: d4 });
    await saver.flush();
    expect(saver.snapshot().failure).toEqual({ kind: "evidence_stopped", reason: "unsupported_step" });
    contents = await journal.readEvidence(DOC, work);
    expect(contents.pending).toHaveLength(1);
    expect((contents.snapshot!.document as unknown as { sheets: { cells: object }[] }).sheets[0]!.cells).toHaveProperty("D1");
  });

  it("halts when another tab moved the journal, and writes nothing over it", async () => {
    const { saver, journal, work } = await saverFor();
    await saver.load();
    // The other tab writes a segment first.
    const other = new SheetSaver(journal, DOC, work, { newId: () => "other" });
    await other.load();
    const d1 = structuredClone(zero);
    d1.sheets[0]!.cells.A1 = { value: 7 } as never;
    await other.edit({ steps: [a1], document: d1 });
    await other.flush();
    const d2 = structuredClone(zero);
    d2.sheets[0]!.cells.B1 = { value: 5 } as never;
    await saver.edit({ steps: [b1], document: d2 });
    await saver.flush();
    expect(saver.snapshot().failure).toMatchObject({ kind: "journal" });
    expect((await journal.readEvidence(DOC, work)).pending).toHaveLength(1);
  });

  it("is unavailable, not an empty sheet, when the journal has no work", async () => {
    const { work } = await started();
    const empty = kit.open(kit.nextScope());
    const saver = new SheetSaver(empty, DOC, work);
    expect((await saver.load()).kind).toBe("unavailable");
  });

  it("resolveInitialSheet: journal first, then server, never an empty sheet", () => {
    const j = { document: zero, revision: 3 };
    const s = { document: zero, revision: 1 };
    expect(resolveInitialSheet(j, s)).toMatchObject({ from: "journal", revision: 3 });
    expect(resolveInitialSheet(null, s)).toMatchObject({ from: "server", revision: 1 });
    expect(resolveInitialSheet(undefined, undefined)).toEqual({ mode: "error" });
  });
});
