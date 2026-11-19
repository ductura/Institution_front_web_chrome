// @vitest-environment node
/**
 * WEB-38 2/2: browserEvidenceSessionDeps end to end in node, through the real
 * journal (AtomicDexieJournal on fake-indexeddb), the real drain runner and
 * evidence transport, createApi and the contract's shapes. Only the server is
 * a fake: the commit route of the editor-core test kit (compare-and-set, one
 * commit per key, receipts signed with a key made for the test) and an open
 * route that reports the work. Every key, id and text is invented.
 *
 * - SYNCED comes only from a signed receipt that verifies under a key of the
 *   opened work (F-3, F-8); a receipt under any other key, or a stored commit
 *   still waiting for its signature, leaves the row owed.
 * - Once the tab's sign-in ends, the drain sends nothing (F-154).
 * - A commit 409 not_accepting closes the session only when the open route
 *   itself says the work is submitted (F-155), and the row stays either way.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { BuiltSegment } from "../../packages/editor-core/src/editor";
import type { AtomicDexieJournal } from "../../packages/editor-core/src/journal/atomic-dexie-journal";
import {
  capture, DOC, journalKit, json, PROFILE, R0, receiptKey, save, server, trusted, UTC, type Answer, type Chain,
} from "../../packages/editor-core/src/sync/runner/evidence-test-kit";
import { encodeBase64, type FetchLike, type OpenedWork } from "./evidence-ingest";
import { browserEvidenceSessionDeps, type BrowserEvidenceInput } from "./evidence-session-deps";

const ASSIGNMENT = "44444444-4444-4444-8444-444444444444";
const source = { navigator: { onLine: true }, addEventListener: () => {}, removeEventListener: () => {} };

let chain: Chain;
let SEG: BuiltSegment[];
beforeAll(async () => {
  chain = await capture(3);
  SEG = chain.segments;
}, 60_000);

// A prefix no journal test in editor-core uses, so the files never share a database.
const { open: openJournal, cleanup } = journalKit("c");
afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
});

async function started(): Promise<AtomicDexieJournal> {
  const journal = openJournal();
  await journal.startEvidence(DOC, chain.opened, UTC);
  return journal;
}

/** The open route's 200 for the work at R0, with `keys` as its receipt keys. */
function opened(submitted = false, keys = [trusted.key]) {
  return json(200, {
    status: "opened", documentId: DOC, evidenceProfileId: PROFILE, currentRevision: R0,
    documentHash: chain.opened.documentHash, headSegmentHash: null, lastSequenceTo: 0,
    document: encodeBase64(chain.opened.document), receiptKeys: keys, submitted,
  });
}

/**
 * The session's adapters over `journal`, the kit's commit route (`answers`
 * first) and an open route answered by `openAnswer`; `signedIn` is the tab's
 * sign-in. Every request that reaches the network is counted by route.
 */
function session(journal: AtomicDexieJournal, answers: Answer[] = [], openAnswer = () => opened()) {
  const net = server(R0, ...answers);
  const signedIn = { value: true };
  const sent = { open: 0, commit: 0 };
  const network: FetchLike = async (url, init) => {
    if (new URL(url).pathname.endsWith("/evidence/open")) {
      sent.open += 1;
      return openAnswer();
    }
    sent.commit += 1;
    return net.fetchImpl(url, init);
  };
  const deps = browserEvidenceSessionDeps({
    journal,
    documentId: DOC,
    assignmentId: ASSIGNMENT,
    current: () => signedIn.value,
    fetchImpl: network,
    source: source as unknown as BrowserEvidenceInput["source"],
  });
  return { deps, net, signedIn, sent };
}

async function work(deps: ReturnType<typeof browserEvidenceSessionDeps>): Promise<OpenedWork> {
  const outcome = await deps.open();
  if (outcome.status !== "opened") throw new Error(`open: ${outcome.status}`);
  return outcome.work;
}

/** Past any retry schedule of the runner: only its plan decides what goes next. */
function later() {
  vi.setSystemTime(Date.now() + 3_600_000);
}

describe("WEB-38: the drain of the browser deps through the real journal", () => {
  it("drains rows in order and shows SYNCED only with the last signed receipt (F-3, F-8)", async () => {
    const journal = await started();
    for (const built of SEG.slice(0, 2)) await save(journal, built);
    const { deps, net, sent } = session(journal);
    const runner = deps.createRunner(await work(deps));
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", ackedRevision: R0 + 1 });
    expect((await journal.readEvidence(DOC)).meta?.state).not.toBe("SYNCED");
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", state: "SYNCED", ackedRevision: R0 + 2 });
    expect(await runner.step(DOC)).toEqual({ kind: "idle" });
    const { meta, pending } = await journal.readEvidence(DOC);
    expect(pending).toEqual([]);
    expect(meta?.evidenceHead).toEqual({ segmentHash: SEG[1]!.sha256, lastSequenceTo: 2 });
    expect(net.calls.map(({ body }) => body.baseRevision)).toEqual([R0, R0 + 1]);
    expect(sent).toEqual({ open: 1, commit: 2 });
  });

  it("a receipt under a key the opened work never gave is no receipt: the row stays, no SYNCED", async () => {
    const journal = await started();
    await save(journal, SEG[0]!);
    const stranger = receiptKey("kljuc-izmisljeni-tudi");
    const forged: Answer = (body) => json(200, {
      status: "committed", revision: R0 + 1,
      receipt: { status: "signed", signedReceipt: stranger.sign({ documentId: DOC, clientTransactionId: body.clientTransactionId, revision: R0 + 1, segmentHash: SEG[0]!.sha256 }) },
    });
    const { deps } = session(journal, [forged]);
    const runner = deps.createRunner(await work(deps));
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", state: "ERROR", ackedRevision: null });
    const { pending, meta } = await journal.readEvidence(DOC);
    expect(pending).toHaveLength(1);
    expect(meta?.state).not.toBe("SYNCED");
    expect(meta?.evidenceHead).toEqual({ segmentHash: null, lastSequenceTo: 0 });
  });

  it("the same signer is trusted only through the work it was opened with", async () => {
    const journal = await started();
    await save(journal, SEG[0]!);
    const other = receiptKey("kljuc-izmisljeni-2");
    // The open route names only another key, so the kit's honest receipt does not verify.
    const { deps } = session(journal, [], () => opened(false, [other.key]));
    const runner = deps.createRunner(await work(deps));
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", state: "ERROR", ackedRevision: null });
    expect((await journal.readEvidence(DOC)).pending).toHaveLength(1);
  });

  it("a stored commit waiting for its signature keeps the row; the same key goes again and SYNCED waits for the receipt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const journal = await started();
    await save(journal, SEG[0]!);
    const pending: Answer = () => json(202, { status: "committed", revision: R0 + 1, receipt: { status: "pending_signature" } });
    const { deps, net } = session(journal, [pending]);
    const runner = deps.createRunner(await work(deps));
    const first = await runner.step(DOC);
    expect(first).toMatchObject({ kind: "sent" });
    expect(first).not.toMatchObject({ state: "SYNCED" });
    expect((await journal.readEvidence(DOC)).pending).toHaveLength(1);
    later();
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", state: "SYNCED", ackedRevision: R0 + 1 });
    expect(net.calls).toHaveLength(2);
    expect(net.calls[1]!.text).toBe(net.calls[0]!.text);
  });
});

describe("WEB-38: F-154 through the drain", () => {
  it("sends nothing once the tab's sign-in has ended; the row stays and nothing is SYNCED", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const journal = await started();
    for (const built of SEG.slice(0, 2)) await save(journal, built);
    const { deps, signedIn, sent } = session(journal);
    const runner = deps.createRunner(await work(deps));
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", ackedRevision: R0 + 1 });
    signedIn.value = false;
    later();
    expect(await runner.step(DOC)).toMatchObject({ kind: "sent", ackedRevision: null });
    later();
    await runner.step(DOC);
    expect(sent).toEqual({ open: 1, commit: 1 });
    const { pending, meta } = await journal.readEvidence(DOC);
    expect(pending).toHaveLength(1);
    expect(meta?.state).not.toBe("SYNCED");
    expect(await deps.open()).toEqual({ status: "unavailable" });
    expect(sent.open).toBe(1);
  });
});

describe("WEB-38: F-155 through the drain", () => {
  const notAccepting: Answer = () => json(409, { status: "not_accepting" });

  it("closes the session by submission only when the open route says submitted; the row stays", async () => {
    const journal = await started();
    await save(journal, SEG[0]!);
    let submitted = false;
    const { deps, sent } = session(journal, [notAccepting], () => opened(submitted));
    const runner = deps.createRunner(await work(deps));
    let closed = 0;
    deps.watchSubmission?.(() => { closed += 1; });
    submitted = true;
    await runner.step(DOC);
    expect(closed).toBe(1);
    expect(sent).toEqual({ open: 2, commit: 1 });
    const { pending, meta } = await journal.readEvidence(DOC);
    expect(pending).toHaveLength(1);
    expect(meta?.state).not.toBe("SYNCED");
  });

  it("closes nothing when the open route says not submitted", async () => {
    const journal = await started();
    await save(journal, SEG[0]!);
    const { deps, sent } = session(journal, [notAccepting], () => opened(false));
    const runner = deps.createRunner(await work(deps));
    let closed = 0;
    deps.watchSubmission?.(() => { closed += 1; });
    await runner.step(DOC);
    expect(closed).toBe(0);
    expect(sent).toEqual({ open: 2, commit: 1 });
    expect((await journal.readEvidence(DOC)).pending).toHaveLength(1);
  });

  it("closes nothing and asks nothing more when the sign-in ends with the commit's answer", async () => {
    const journal = await started();
    await save(journal, SEG[0]!);
    let signOut = () => {};
    const { deps, signedIn, sent } = session(journal, [() => { signOut(); return json(409, { status: "not_accepting" }); }], () => opened(true));
    signOut = () => { signedIn.value = false; };
    const runner = deps.createRunner(await work(deps));
    let closed = 0;
    deps.watchSubmission?.(() => { closed += 1; });
    await runner.step(DOC);
    expect(closed).toBe(0);
    expect(sent).toEqual({ open: 1, commit: 1 });
    expect((await journal.readEvidence(DOC)).pending).toHaveLength(1);
  });
});
