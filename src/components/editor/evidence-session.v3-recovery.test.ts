// @vitest-environment node
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import type { OpenedWork, OpenOutcome } from "@/client/evidence-ingest";
import { drainJournalFor } from "@/client/evidence-session-deps";
import type { CanonicalDocument, CanonicalDocumentV3 } from "@/domain/document";
import {
  REVISION_ZERO_JCS, REVISION_ZERO_SHA256, REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256,
} from "@/domain/document/revision-zero";
import { canonicalizeJcs, jcsUtf8Bytes } from "@/domain/forensics/jcs";
import { createBrowserEditStepsV1Replayer } from "@/domain/forensics/replay/edit-steps-v1-browser-replayer";
import { createBrowserAcademicReplayer } from "@/domain/forensics/replay/edit-steps-versioned-browser-replayer";
import { verifyWorkOpening, type VerifiedWorkOpening } from "@/domain/serverSync/work-opening";
import type { QueuedTransaction } from "@/domain/sync/journal-types";
import { canonicalToTiptap, canonicalToTiptapV3, createEditorExtensions, createEditorExtensionsV3 } from "@/editor";
import type { AtomicDexieJournal } from "@/lib/journal/atomic-dexie-journal";
import { createDrainRunner } from "@/lib/sync/drain-runner";
import { createEvidenceTransport, evidenceVerifierFor } from "@/lib/sync/evidence-transport";
import { conflict, DOC, DOMAIN, journalKit, PROFILE, raw, server, sha256, trusted } from "@/lib/sync/evidence-test-kit";

import { EvidenceSession, type EvidenceSessionDeps, type SheetDocument } from "./evidence-session";
import { sheetCandidate } from "./LocalDocument";

/**
 * PIL-K-V3-OPORAVAK: a work confirmed as schema v3 leaves CONFLICT the way a
 * v1 work does (take the server's version, keep the local text as a copy),
 * through the session and the journal's `adoptServerEvidence` and
 * `readSalvage` under a verified v3 opening; and a v3 work opened again
 * without a network stays "unavailable". Real recorder, headless editors,
 * journal on fake-indexeddb, the kit's commit route with an invented key.
 * Every id, key and text is invented.
 */

const { open: openJournal, cleanup } = journalKit("f");
const editors: Editor[] = [];
afterEach(async () => {
  for (const editor of editors.splice(0)) editor.destroy();
  await cleanup();
});

const encoder = new TextEncoder();
const NOW = "2026-11-23T12:00:00.000Z";
type Version = 1 | 3;

function revisionZero(version: Version, over: Partial<OpenedWork> = {}): OpenedWork {
  const [jcs, hash] = version === 3 ? [REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256] : [REVISION_ZERO_JCS, REVISION_ZERO_SHA256];
  return {
    documentId: DOC, evidenceProfileId: PROFILE, currentRevision: 0, documentHash: hash, headSegmentHash: null,
    lastSequenceTo: 0, document: encoder.encode(jcs), evidenceDomainId: DOMAIN, receiptKeys: [trusted.key], submitted: false,
    ...(version === 3 ? { schemaVersion: 3 as const } : {}), ...over,
  };
}

const offline = () => ({ online: () => false, onOnline: () => () => {} });

/** A session whose open route answers `answers` in turn (the last one again), offline unless told. */
function sessionFor(journal: AtomicDexieJournal, version: Version, answers: OpenOutcome[], over: Partial<EvidenceSessionDeps> = {}) {
  let id = 0;
  let call = 0;
  const opens: number[] = [];
  const session = new EvidenceSession({
    journal,
    documentId: DOC,
    open: async () => {
      opens.push(call);
      return answers[Math.min(call++, answers.length - 1)]!;
    },
    replayer: version === 3 ? () => createBrowserAcademicReplayer(3) : createBrowserEditStepsV1Replayer,
    createRunner: (opened, verified) => createDrainRunner<QueuedTransaction>({
      journal: verified ? drainJournalFor(journal, verified) : journal,
      transport: createEvidenceTransport(server(0).fetchImpl, undefined, verified),
      verifyFor: evidenceVerifierFor(opened),
    }),
    network: offline(),
    now: () => new Date(NOW),
    newId: () => `aaaaaaaa-0000-4000-8000-${(id += 1).toString(16).padStart(12, "0")}`,
    ...(version === 3 ? { schemaVersion: 3 as const } : {}),
    ...over,
  });
  return { session, opens };
}

const opened = (work: OpenedWork): OpenOutcome => ({ status: "opened", work });

/** Loads `session`, types `text` on a headless sheet of `version` and saves it as LocalDocument does. */
async function typed(session: EvidenceSession, version: Version, text: string): Promise<SheetDocument> {
  const result = await session.load();
  if (result.kind !== "ready") throw new Error(`load: ${result.kind}`);
  const editor = new Editor({
    element: null,
    extensions: version === 3 ? createEditorExtensionsV3() : createEditorExtensions(),
    content: version === 3 ? canonicalToTiptapV3(result.document as CanonicalDocumentV3) : canonicalToTiptap(result.document as CanonicalDocument),
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  editors.push(editor);
  let at = Date.parse(NOW);
  editor.on("transaction", ({ transaction, appendedTransactions }) => {
    session.record([transaction, ...appendedTransactions], undefined, (at += 100));
  });
  editor.view.dispatch(editor.state.tr.insertText(text));
  const candidate = sheetCandidate(editor, version);
  if (!candidate) throw new Error("the sheet cannot be stored");
  session.edit();
  await session.propose(candidate.doc);
  await session.settled();
  return candidate.doc;
}

const read = (journal: AtomicDexieJournal, verified?: VerifiedWorkOpening) =>
  verified ? journal.readEvidence(DOC, verified) : journal.readEvidence(DOC);

/** What the journal holds for `DOC`, every table, to prove a refusal wrote nothing. */
async function everything(journal: AtomicDexieJournal) {
  const db = raw(journal);
  return {
    meta: await db.table("meta").toArray(), snapshots: await db.table("snapshots").toArray(),
    pending: await db.table("pending").toArray(), salvage: await db.table("salvage").toArray(),
  };
}

/**
 * A work of `version` in CONFLICT on this device: one local row, refused by
 * the server, whose version (revision 2) another device wrote. Returns the
 * journal, the local text, and the server's open answer after the conflict.
 */
async function inConflict(version: Version) {
  const zero = revisionZero(version);
  const verified0 = version === 3 ? (await verifyWorkOpening(DOC, zero))! : undefined;
  // The other device: its row is what the server holds at revision 2.
  const other = openJournal();
  await typed(sessionFor(other, version, [opened(zero)]).session, version, "Uvod s drugog uređaja");
  const { tx } = (await read(other, verified0)).pending[0]!;
  const serverWork = revisionZero(version, {
    currentRevision: 2, documentHash: sha256(tx.document), headSegmentHash: tx.segmentHash,
    lastSequenceTo: tx.sequenceTo, document: tx.document,
    ...(version === 3 ? { revisionZeroHash: REVISION_ZERO_V3_SHA256 } : {}),
  });

  const journal = openJournal();
  const first = sessionFor(journal, version, [opened(zero)]).session;
  const local = await typed(first, version, "Moj izmišljeni uvod");
  first.close();
  const runner = createDrainRunner<QueuedTransaction>({
    journal: verified0 ? drainJournalFor(journal, verified0) : journal,
    transport: createEvidenceTransport(server(0, () => conflict("chain_conflict", 2)).fetchImpl, undefined, verified0),
    verifyFor: evidenceVerifierFor(zero),
  });
  await runner.step(DOC);
  expect((await read(journal, verified0)).meta).toMatchObject({ state: "CONFLICT", conflictRevision: 2 });
  return { journal, local, serverWork, otherDocument: tx.document };
}

describe("PIL-K-V3-OPORAVAK: a v3 work leaves CONFLICT as a v1 work does", () => {
  it("takes the server's verified v3 version, keeps the local v3 text as a copy, and writes on", async () => {
    const { journal, local, serverWork, otherDocument } = await inConflict(3);
    const { session } = sessionFor(journal, 3, [opened(serverWork)]);
    // Sticky: the local text is shown read-only and nothing is sent.
    expect(await session.load()).toEqual({ kind: "recovery", reason: "sticky", document: local });
    expect(session.snapshot().state).toBe("CONFLICT");

    const result = await session.adoptServer(true);
    expect(result).toMatchObject({
      kind: "adopted",
      meta: { evidenceHead: { segmentHash: serverWork.headSegmentHash, lastSequenceTo: serverWork.lastSequenceTo }, evidenceProfileId: PROFILE },
    });
    const verified = (await verifyWorkOpening(DOC, serverWork, { documentId: DOC, sha256: REVISION_ZERO_V3_SHA256 }))!;
    const after = await journal.readEvidence(DOC, verified);
    expect(after.pending).toHaveLength(0);
    expect(after.snapshot?.revision).toBe(2);
    expect(jcsUtf8Bytes(after.snapshot!.document)).toEqual(otherDocument);
    // The v1 read never sees the v3 record.
    await expect(journal.readEvidence(DOC)).rejects.toMatchObject({ code: "invalid_input" });

    // A new session (the reload after the decision) opens the server's version and keeps writing v3.
    const next = sessionFor(journal, 3, [opened(serverWork)]).session;
    const copies = await next.salvage();
    expect(copies).toBeNull(); // nothing verified before load
    const written = await typed(next, 3, " i nastavak");
    expect(written.schemaVersion).toBe(3);
    const kept = await next.salvage();
    expect(kept).toHaveLength(1);
    expect(kept![0]).toMatchObject({ documentId: DOC, cause: "CONFLICT" });
    expect(canonicalizeJcs(kept![0]!.document)).toBe(canonicalizeJcs(local));
    const { pending } = await journal.readEvidence(DOC, verified);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.tx.sequenceFrom).toBe(serverWork.lastSequenceTo + 1);
  });

  it("a session that met the conflict itself verifies the server's moved version again before taking it", async () => {
    const { serverWork, otherDocument } = await inConflict(3);
    const journal = openJournal();
    const zero = revisionZero(3);
    const { session, opens } = sessionFor(journal, 3, [opened(zero), opened(serverWork)], {
      createRunner: (work, verified) => createDrainRunner<QueuedTransaction>({
        journal: drainJournalFor(journal, verified!),
        transport: createEvidenceTransport(server(0, () => conflict("chain_conflict", 2)).fetchImpl, undefined, verified),
        verifyFor: evidenceVerifierFor(work),
        now: () => 0, jitter: () => 0.5,
      }),
      network: { online: () => true, onOnline: () => () => {} },
    });
    await typed(session, 3, "Moj izmišljeni uvod");
    await session.settled();
    expect(session.snapshot().state).toBe("CONFLICT");
    // The opening verified at load names revision 0; the server is at 2 now.
    expect(await session.adoptServer(true)).toMatchObject({ kind: "adopted", meta: { evidenceProfileId: PROFILE } });
    expect(opens).toHaveLength(2);
    const verified = (await verifyWorkOpening(DOC, serverWork, { documentId: DOC, sha256: REVISION_ZERO_V3_SHA256 }))!;
    expect(jcsUtf8Bytes((await journal.readEvidence(DOC, verified)).snapshot!.document)).toEqual(otherDocument);
    expect(await session.salvage()).toHaveLength(1);
  });

  it("refuses, writing nothing, when the server's new answer is not verified as this v3 work", async () => {
    const { journal, serverWork } = await inConflict(3);
    const unverified = [
      { status: "unavailable" } as const,
      opened({ ...serverWork, revisionZeroHash: undefined }),
      opened({ ...serverWork, schemaVersion: 1 }),
      opened({ ...serverWork, revisionZeroHash: REVISION_ZERO_SHA256 }),
      opened({ ...serverWork, documentHash: "d".repeat(64) }),
    ];
    for (const answer of unverified) {
      const { session } = sessionFor(journal, 3, [opened(serverWork), answer]);
      expect((await session.load()).kind).toBe("recovery");
      const before = await everything(journal);
      expect(await session.adoptServer(true)).toEqual({ kind: "unavailable" });
      expect(await everything(journal)).toEqual(before);
      session.close();
    }
  });

  it("the journal's own refusals come back as codes and write nothing", async () => {
    const { journal, serverWork } = await inConflict(3);
    // A server version behind the revision the refusal named.
    const behind = sessionFor(journal, 3, [opened(serverWork), opened({ ...serverWork, currentRevision: 1 })]).session;
    expect((await behind.load()).kind).toBe("recovery");
    const before = await everything(journal);
    expect(await behind.adoptServer(true)).toEqual({ kind: "refused", code: "invalid_input" });
    expect(await everything(journal)).toEqual(before);
    // A closed session asks nothing.
    behind.close();
    expect(await behind.adoptServer(true)).toEqual({ kind: "unavailable" });
    expect(await everything(journal)).toEqual(before);
  });

  it("a v1 work leaves CONFLICT through the session exactly as through the journal itself", async () => {
    const twinA = await inConflict(1);
    const twinB = await inConflict(1);
    expect(await everything(twinA.journal)).toEqual(await everything(twinB.journal));

    const { session } = sessionFor(twinA.journal, 1, [opened(twinA.serverWork)]);
    expect((await session.load()).kind).toBe("recovery");
    expect((await session.adoptServer(true)).kind).toBe("adopted");
    const seq = (await twinB.journal.readEvidence(DOC)).meta!.localSeq;
    await twinB.journal.adoptServerEvidence(DOC, twinB.serverWork, true, NOW, seq);
    // Byte for byte the same record: the v1 way out is the journal's v1 call.
    expect(await everything(twinA.journal)).toEqual(await everything(twinB.journal));

    const copies = await sessionFor(twinA.journal, 1, [opened(twinA.serverWork)]).session.salvage();
    expect(copies).toHaveLength(1);
    expect(canonicalizeJcs(copies![0]!.document)).toBe(canonicalizeJcs(twinA.local));
    expect(copies![0]!.document.schemaVersion).toBe(1);
  });
});

describe("PIL-K-V3-OPORAVAK: a v3 work opened again without a network", () => {
  it("stays unavailable: nothing is read, written or shown from the stored v3 record", async () => {
    const journal = openJournal();
    const zero = revisionZero(3);
    const first = sessionFor(journal, 3, [opened(zero)]).session;
    await typed(first, 3, "Tekst spremljen na uređaju");
    first.close();
    const before = await everything(journal);

    // The reload: the open route cannot be reached.
    const { session, opens } = sessionFor(journal, 3, [{ status: "unavailable" }]);
    expect(await session.load()).toEqual({ kind: "unavailable" });
    expect(session.snapshot()).toMatchObject({ failure: "unavailable" });
    expect(opens).toHaveLength(1);
    expect(await session.salvage()).toBeNull();
    expect(await everything(journal)).toEqual(before);
    // No core API gives a verified opening from the record itself: the read
    // without one refuses the v3 snapshot, so nothing is shown from it.
    await expect(journal.readEvidence(DOC)).rejects.toMatchObject({ code: "invalid_input" });
  });
});
