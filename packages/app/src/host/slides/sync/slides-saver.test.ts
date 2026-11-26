// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { OpenedWork, OpenOutcome } from "../../../../../../src/client/evidence-ingest.ts";
import { slidesRevisionZeroDocument } from "../../../../../editor-core/src/slides/model.ts";
import { slidesSnapshotBytes, slidesSnapshotSha256 } from "../../../../../editor-core/src/slides/json.ts";
import type { SlideStep } from "../../../../../editor-core/src/slides/steps.ts";
import type { DrainRunner } from "../../../../../editor-core/src/sync/runner/drain-runner.ts";
import { journalKit, PROFILE, DOC } from "../../../../../editor-core/src/sync/runner/evidence-test-kit.ts";
import { SlidesSaver, type SlidesSaverDeps } from "./slides-saver.ts";

/** Invented work, invented ids; the journal runs on fake-indexeddb, the network is a stub. */
const kit = journalKit("c");
afterEach(kit.cleanup);

const ZERO = slidesRevisionZeroDocument();
const NEW_SLIDE = "44444444-4444-4444-8444-444444444444";
const addSlide: SlideStep = { type: "slideAdd", slideId: NEW_SLIDE, layout: "title", index: 1 };
const withSlide = () => ({ ...ZERO, slides: [...ZERO.slides, { id: NEW_SLIDE, layout: "title" as const, blocks: [] }] });

async function work(over: Partial<OpenedWork> = {}): Promise<OpenedWork> {
  return {
    documentId: DOC, evidenceProfileId: PROFILE, currentRevision: 0, documentHash: await slidesSnapshotSha256(ZERO),
    headSegmentHash: null, lastSequenceTo: 0, document: slidesSnapshotBytes(ZERO), evidenceDomainId: "domena",
    receiptKeys: [], submitted: false, documentKind: "slides", ...over,
  };
}

type Net = { online: boolean; listeners: Set<() => void> };

function build(scope: string, outcome: () => Promise<OpenOutcome>, runner: DrainRunner | null = null, net: Net = { online: true, listeners: new Set() }) {
  const journal = kit.open(scope);
  const deps: SlidesSaverDeps = {
    journal, documentId: DOC, open: outcome,
    createRunner: () => runner ?? { step: async () => ({ kind: "idle" as const }) },
    network: { online: () => net.online, onOnline: (l) => { net.listeners.add(l); return () => net.listeners.delete(l); } },
    setTimer: () => null, clearTimer: () => {}, saveDebounceMs: 0,
  };
  return { saver: new SlidesSaver(deps), journal, net };
}

describe("the slides session", () => {
  it("opens revision zero from the server, saves a change on the device and says so", async () => {
    const scope = kit.nextScope();
    const { saver, journal } = build(scope, async () => ({ status: "opened", work: await work() }));
    const loaded = await saver.load();
    expect(loaded).toMatchObject({ kind: "ready", readOnly: false });
    saver.record([addSlide], withSlide(), "unattributed", Date.parse("2026-11-26T10:00:00Z"));
    expect(saver.snapshot().state).toBe("EDITING");
    await saver.flush();
    expect(saver.snapshot().state).toBe("LOCAL_DURABLE");
    expect(saver.snapshot().receiptVerified).toBe(false);
    const stored = await journal.readEvidence(DOC, (await journal.readVerifiedWork(DOC))!);
    expect(stored.pending).toHaveLength(1);
    expect((stored.snapshot!.document as unknown as { slides: unknown[] }).slides).toHaveLength(2);
  });

  it("reopens without a network from the stored verified opening and keeps the saved slides", async () => {
    const scope = kit.nextScope();
    const first = build(scope, async () => ({ status: "opened", work: await work() }));
    await first.saver.load();
    first.saver.record([addSlide], withSlide(), "unattributed", Date.parse("2026-11-26T10:00:00Z"));
    await first.saver.flush();
    first.saver.close();
    const second = build(scope, async () => ({ status: "unavailable", offline: true }));
    const loaded = await second.saver.load();
    expect(loaded.kind).toBe("ready");
    if (loaded.kind === "ready") expect(loaded.document.slides).toHaveLength(2);
    expect(second.saver.snapshot().state).toBe("LOCAL_DURABLE");
  });

  it("refuses a work the server does not call slides, and opens nothing offline without a stored opening", async () => {
    const text = build(kit.nextScope(), async () => ({ status: "opened", work: await work({ documentKind: undefined }) }));
    expect((await text.saver.load()).kind).toBe("unavailable");
    const nothing = build(kit.nextScope(), async () => ({ status: "unavailable" }));
    expect((await nothing.saver.load()).kind).toBe("unavailable");
    const foreign = build(kit.nextScope(), async () => ({ status: "opened", work: await work({ documentId: "tudji-rad" }) }));
    expect((await foreign.saver.load()).kind).toBe("unavailable");
  });

  it("shows SYNCED only from the journal's own state, not from a runner's word", async () => {
    let calls = 0;
    // A runner that says it sent and reached SYNCED while the journal still owes the row.
    const runner: DrainRunner = { step: async () => { calls += 1; return calls === 1 ? { kind: "sent", state: "SYNCED", ackedRevision: 1 } : { kind: "idle" }; } };
    const { saver } = build(kit.nextScope(), async () => ({ status: "opened", work: await work() }), runner);
    await saver.load();
    saver.record([addSlide], withSlide(), "unattributed", Date.parse("2026-11-26T10:00:00Z"));
    await saver.flush();
    await saver.settled();
    expect(calls).toBeGreaterThan(0);
    expect(saver.snapshot().state).toBe("LOCAL_DURABLE");
  });

  it("closes by submission when the open answer says the work is submitted, and saves nothing then", async () => {
    const { saver, journal } = build(kit.nextScope(), async () => ({ status: "opened", work: await work({ submitted: true }) }));
    expect(await saver.load()).toMatchObject({ kind: "ready", readOnly: true });
    saver.record([addSlide], withSlide());
    await saver.flush();
    expect(saver.snapshot().closedBy).toBe("submission");
    const verified = (await journal.readVerifiedWork(DOC))!;
    expect((await journal.readEvidence(DOC, verified)).pending).toHaveLength(0);
  });

  it("saves a change the recorder refuses without evidence and says the record stopped", async () => {
    const { saver, journal } = build(kit.nextScope(), async () => ({ status: "opened", work: await work() }));
    await saver.load();
    const bad: SlideStep = { type: "slideMove", slideId: "55555555-5555-4555-8555-555555555555", toIndex: 0 };
    saver.record([bad], withSlide(), "unattributed", Date.parse("2026-11-26T10:00:00Z"));
    await saver.flush();
    expect(saver.snapshot().stopped).toBe(true);
    const verified = (await journal.readVerifiedWork(DOC))!;
    const contents = await journal.readEvidence(DOC, verified);
    expect(contents.pending).toHaveLength(0);
    expect(contents.meta?.evidenceStopped).toBeDefined();
  });
});

describe("review findings of #847", () => {
  it("tries to save again after a failed write instead of stopping for the session", async () => {
    const { saver, journal } = build(kit.nextScope(), async () => ({ status: "opened", work: await work() }));
    await saver.load();
    const real = journal.saveSegment.bind(journal);
    let fail = true;
    (journal as unknown as { saveSegment: unknown }).saveSegment = async (...args: Parameters<typeof real>) => {
      if (fail) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
      return real(...args);
    };
    saver.record([addSlide], withSlide(), "unattributed", Date.parse("2026-11-26T10:00:00Z"));
    await saver.flush();
    expect(saver.snapshot().state).toBe("ERROR");
    fail = false;
    await saver.flush();
    expect(saver.snapshot().failure).toBeNull();
    expect(saver.snapshot().state).toBe("LOCAL_DURABLE");
  });

  it("does not turn an edit made during the final read into an evidence stop", async () => {
    const { saver, journal } = build(kit.nextScope(), async () => ({ status: "opened", work: await work() }));
    await saver.load();
    const real = journal.readEvidence.bind(journal);
    let reads = 0;
    let saved = false;
    const realSave = journal.saveSegment.bind(journal);
    (journal as unknown as { saveSegment: unknown }).saveSegment = async (...args: Parameters<typeof realSave>) => { const r = await realSave(...args); saved = true; return r; };
    const second: SlideStep = { type: "layoutSet", slideId: NEW_SLIDE, layout: "titleContent" };
    (journal as unknown as { readEvidence: unknown }).readEvidence = async (...args: Parameters<typeof real>) => {
      const out = await real(...args);
      if (saved) reads += 1;
      // The author edits while the last read of the save is pending.
      if (reads === 2) saver.record([second], { ...withSlide(), slides: [ZERO.slides[0]!, { id: NEW_SLIDE, layout: "titleContent", blocks: [] }] }, "unattributed", Date.parse("2026-11-26T10:00:05Z"));
      return out;
    };
    saver.record([addSlide], withSlide(), "unattributed", Date.parse("2026-11-26T10:00:00Z"));
    await saver.flush();
    await saver.flush();
    expect(saver.snapshot().stopped).toBe(false);
    expect(saver.snapshot().state).toBe("LOCAL_DURABLE");
  });
});
