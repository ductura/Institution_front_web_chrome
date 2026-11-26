// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { replayEvidenceSegmentsV2 } from "../document/forensics/evidence-replay-v2";
import { createSlidesReplayer, SlideCaptureError, SlidesRecorder } from "../document/forensics/slides-evidence";
import type { JcsJsonValue } from "../document/forensics/jcs";
import { verifyCanonicalEvidencePayloadV2 } from "../document/forensics/evidence-chain-v2";
import { verifyWorkOpening } from "../serverSync/work-opening";
import {
  SLIDES_REVISION_ZERO_SHA256, slidesRevisionZeroDocument, SLIDES_REVISION_ZERO_SLIDE_ID,
} from "../slides/model";
import { slidesSnapshotBytes } from "../slides/json";
import { SLIDE_STEP_FORMAT_V1, type SlideStep } from "../slides/steps";
import type { EvidenceOpening } from "../sync/journal-types";
import { DOC, journalKit, PROFILE, sha256, UTC } from "../sync/runner/evidence-test-kit";

/** WEB-V13-DNEVNIK-SINKRONIZACIJA: the journal holds a slides work the way it holds a text one. Invented data. */
const kit = journalKit("b");
afterEach(kit.cleanup);

const SLIDE2 = "22222222-2222-4222-8222-222222222222";
const BLOCK = "33333333-3333-4333-8333-333333333333";

function zeroOpening(over: Partial<EvidenceOpening> = {}): EvidenceOpening & { documentKind: "slides" } {
  const document = slidesSnapshotBytes(slidesRevisionZeroDocument());
  return {
    documentId: DOC, currentRevision: 0, documentHash: sha256(document), headSegmentHash: null,
    lastSequenceTo: 0, document, evidenceProfileId: PROFILE, documentKind: "slides", ...over,
  };
}

const addSlide: SlideStep = { type: "slideAdd", slideId: SLIDE2, layout: "title", index: 1 };
const context = (over = {}) => ({
  documentId: DOC, sessionId: "sjednica-1", segmentId: "segment-1", evidenceProfileId: PROFILE,
  sequenceFrom: 1, predecessorSegmentHash: null, ...over,
});

async function started() {
  const opened = zeroOpening();
  const work = (await verifyWorkOpening(DOC, opened))!;
  const journal = kit.open();
  await journal.startEvidence(DOC, opened, UTC, work);
  return { journal, work, opened };
}

describe("a slides work in the journal", () => {
  it("verifies revision zero and refuses anything else as revision zero", async () => {
    const work = await verifyWorkOpening(DOC, zeroOpening());
    expect(work?.documentKind).toBe("slides");
    expect(work?.snapshotSha256).toBe(SLIDES_REVISION_ZERO_SHA256);
    const other = slidesRevisionZeroDocument();
    other.slides.push({ id: SLIDE2, layout: "title", blocks: [] });
    const bytes = slidesSnapshotBytes(other);
    expect(await verifyWorkOpening(DOC, zeroOpening({ document: bytes, documentHash: sha256(bytes) }))).toBeNull();
    expect(await verifyWorkOpening(DOC, zeroOpening({ documentHash: "0".repeat(64) }))).toBeNull();
    expect(await verifyWorkOpening("tudji-rad", zeroOpening())).toBeNull();
    expect(await verifyWorkOpening(DOC, zeroOpening(), { documentId: DOC, sha256: "f".repeat(64) })).toBeNull();
  });

  it("records steps, saves the segment, replays it and keeps the chain", async () => {
    const { journal, work } = await started();
    const recorder = new SlidesRecorder(slidesRevisionZeroDocument());
    await recorder.record({ steps: [addSlide], source: "unattributed", at: Date.parse(UTC) });
    recorder.close();
    const built = (await recorder.takeSegment(context()))!;
    expect(built.segment.captureContext.transactionFormat).toBe(SLIDE_STEP_FORMAT_V1);
    expect((await verifyCanonicalEvidencePayloadV2(built.bytes, SLIDE_STEP_FORMAT_V1)).ok).toBe(true);
    // A text reader refuses the same bytes.
    expect((await verifyCanonicalEvidencePayloadV2(built.bytes)).ok).toBe(false);
    const replay = await replayEvidenceSegmentsV2(
      slidesRevisionZeroDocument() as unknown as JcsJsonValue, [built.segment], createSlidesReplayer());
    expect(replay.ok && replay.documentSha256).toBe(built.segment.finalDocumentHash);

    const saved = await journal.saveSegment(DOC, built, UTC, 0, work);
    expect(saved.meta.state).toBe("LOCAL_DURABLE");
    const contents = await journal.readEvidence(DOC, work);
    expect(contents.pending).toHaveLength(1);
    expect((contents.snapshot!.document as unknown as { slides: unknown[] }).slides).toHaveLength(2);
    // The text reader never takes a slides snapshot, and a slides work needs its own opening.
    await expect(journal.readEvidence(DOC)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(journal.read(DOC)).rejects.toMatchObject({ code: "invalid_input" });
    // Offline reopening from the stored verified opening.
    const again = await journal.readVerifiedWork(DOC);
    expect(again?.documentKind).toBe("slides");
  });

  it("refuses a segment whose document is not the slides document it ends in", async () => {
    const { journal, work } = await started();
    const recorder = new SlidesRecorder(slidesRevisionZeroDocument());
    await recorder.record({ steps: [addSlide], source: "unattributed", at: Date.parse(UTC) });
    recorder.close();
    const built = (await recorder.takeSegment(context()))!;
    const wrong = { ...built, document: slidesSnapshotBytes(slidesRevisionZeroDocument()) };
    await expect(journal.saveSegment(DOC, wrong, UTC, 0, work)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("stops the recorder at a change the replayer would refuse, and ignores a no-op", async () => {
    const recorder = new SlidesRecorder(slidesRevisionZeroDocument());
    await recorder.record({ steps: [], source: "unattributed", at: 1 });
    expect(recorder.pendingEvents).toBe(0);
    const bad: SlideStep = { type: "slideMove", slideId: "00000000-0000-4000-8000-0000000000ff", toIndex: 0 };
    await expect(recorder.record({ steps: [bad], source: "unattributed", at: 2 })).rejects.toBeInstanceOf(SlideCaptureError);
    expect(recorder.intact).toBe(false);
    await expect(recorder.record({ steps: [addSlide], source: "unattributed", at: 3 })).rejects.toBeInstanceOf(SlideCaptureError);
    // A step with a time field is not a step of the format.
    const fresh = new SlidesRecorder(slidesRevisionZeroDocument());
    await expect(fresh.record({ steps: [{ ...addSlide, time: 1 } as unknown as SlideStep], source: "unattributed", at: 1 }))
      .rejects.toMatchObject({ code: "unsupported_step" });
  });

  it("merges changes within the quiet time into one event and splits on a pause", async () => {
    const recorder = new SlidesRecorder(slidesRevisionZeroDocument());
    const t = Date.parse(UTC);
    await recorder.record({ steps: [addSlide], source: "unattributed", at: t });
    await recorder.record({ steps: [{ type: "layoutSet", slideId: SLIDE2, layout: "titleContent" }], source: "unattributed", at: t + 100 });
    await recorder.record({ steps: [{ type: "layoutSet", slideId: SLIDE2, layout: "title" }], source: "unattributed", at: t + 5000 });
    recorder.close();
    const built = (await recorder.takeSegment(context()))!;
    expect(built.eventCount).toBe(2);
    expect(built.timing.events[0]!.stepOffsetsMs).toEqual([0, 100]);
    void BLOCK; void SLIDES_REVISION_ZERO_SLIDE_ID;
  });

  it("leaves nothing of a slides work after logout", async () => {
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
