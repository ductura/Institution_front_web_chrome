// @vitest-environment node
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { paragraphNode, textNode, type CanonicalDocumentV3 } from "../document/document";
import {
  REVISION_ZERO_JCS, REVISION_ZERO_NODE_ID, REVISION_ZERO_SHA256, REVISION_ZERO_V2_JCS, REVISION_ZERO_V2_SHA256,
  REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256, revisionZeroDocumentV3,
} from "../document/document/revision-zero";
import { canonicalizeJcs } from "../document/forensics/jcs";
import { verifyWorkOpening, type VerifiedWorkOpening } from "../serverSync/work-opening";
import type { EvidenceOpening, StoredWorkOpening } from "../sync/journal-types";
import { DOC, deps, journalKit, PROFILE, raw, sha256, UTC } from "../sync/runner/evidence-test-kit";
import type { AtomicDexieJournal } from "./atomic-dexie-journal";

/**
 * PIL-K-V3-BEZ-MREZE (owner decision 23. 11. 2026.): the journal keeps the
 * verified opening of a work beside its record (store `works`, version 5) and
 * `readVerifiedWork` gives it back only when it still verifies from its own
 * bytes and describes the record. Fail-closed: any mismatch is null. Journal
 * on fake-indexeddb; every id and text is invented.
 */

const kit = journalKit("a");
afterEach(kit.cleanup);

const encoder = new TextEncoder();
const LATER = "2026-10-24T12:30:00.000Z";

function opening(jcs: string, over: Partial<EvidenceOpening> = {}): EvidenceOpening {
  const document = encoder.encode(jcs);
  return {
    documentId: DOC, currentRevision: 0, documentHash: sha256(document), headSegmentHash: null,
    lastSequenceTo: 0, document, evidenceProfileId: PROFILE, ...over,
  };
}

/** A v3 work at revision 7, as another device left it: verified only with the revision zero proof. */
function laterV3(): EvidenceOpening {
  const doc: CanonicalDocumentV3 = {
    ...revisionZeroDocumentV3(), nodes: [paragraphNode(REVISION_ZERO_NODE_ID, [textNode("Izmišljeni uvod")])],
  };
  return opening(canonicalizeJcs(doc), {
    currentRevision: 7, headSegmentHash: "c".repeat(64), lastSequenceTo: 3,
  });
}

async function startedV3(opened = opening(REVISION_ZERO_V3_JCS)) {
  const proof = opened.currentRevision === 0 ? undefined : { documentId: DOC, sha256: REVISION_ZERO_V3_SHA256 };
  const work = (await verifyWorkOpening(DOC, opened, proof))!;
  const journal = kit.open();
  await journal.startEvidence(DOC, opened, UTC, work);
  return { journal, work };
}

const works = (journal: AtomicDexieJournal) => raw(journal).table<StoredWorkOpening, string>("works");

async function tamper(journal: AtomicDexieJournal, change: (row: StoredWorkOpening) => unknown) {
  const row = (await works(journal).get(DOC))!;
  await works(journal).put(change({ ...row, document: new Uint8Array(row.document) }) as StoredWorkOpening);
}

function sameWork(read: VerifiedWorkOpening | null, work: VerifiedWorkOpening) {
  expect(read).not.toBeNull();
  expect({ ...read }).toEqual({ ...work });
}

describe("PIL-K-V3-BEZ-MREZE: the verified opening read back from the device", () => {
  it("a v3 work opened at revision zero opens again from its record alone", async () => {
    const { journal, work } = await startedV3();
    const read = await journal.readVerifiedWork(DOC);
    sameWork(read, work);
    // The read opening is a real one: the journal takes the v3 record under it.
    expect((await journal.readEvidence(DOC, read!)).snapshot?.document.schemaVersion).toBe(3);
    expect(await works(journal).get(DOC)).toMatchObject({
      documentId: DOC, currentRevision: 0, documentHash: REVISION_ZERO_V3_SHA256, schemaVersion: 3,
      revisionZeroHash: REVISION_ZERO_V3_SHA256, verifiedAt: UTC, evidenceProfileId: PROFILE,
    });
  });

  it("a later v3 revision keeps the revision zero proof it was verified with", async () => {
    const later = laterV3();
    const { journal, work } = await startedV3(later);
    sameWork(await journal.readVerifiedWork(DOC), work);
    // Without the proof the same answer is no v3 opening: the proof is what was kept.
    expect(await verifyWorkOpening(DOC, later)).toBeNull();
  });

  it("a fresh journal and a journal from another device hold nothing to open", async () => {
    const { journal } = await startedV3();
    expect(await journal.readVerifiedWork("drugi-izmisljeni-rad")).toBeNull();
    expect(await kit.open().readVerifiedWork(DOC)).toBeNull();
    await expect(journal.readVerifiedWork("")).rejects.toMatchObject({ code: "invalid_input" });
  });

  it.each<[string, (row: StoredWorkOpening) => unknown]>([
    ["one changed byte of the snapshot", (row) => { row.document[row.document.length - 2] ^= 1; return row; }],
    ["bytes swapped for another valid snapshot", (row) => ({ ...row, document: encoder.encode(REVISION_ZERO_V2_JCS) })],
    ["a hash that does not name the bytes", (row) => ({ ...row, documentHash: "d".repeat(64) })],
    ["a revision zero proof of another schema", (row) => ({ ...row, revisionZeroHash: REVISION_ZERO_V2_SHA256 })],
    ["a forged revision zero proof", (row) => ({ ...row, revisionZeroHash: "e".repeat(64) })],
    ["the schema claimed as v2", (row) => ({ ...row, schemaVersion: 2 })],
    ["a revision ahead of the record", (row) => ({ ...row, currentRevision: 9 })],
    ["a head ahead of the record", (row) => ({ ...row, lastSequenceTo: 5 })],
    ["another profile than the record's", (row) => ({ ...row, evidenceProfileId: "profil-podmetnuti" })],
    ["bytes stored as a plain array", (row) => ({ ...row, document: Array.from(row.document) })],
    ["a missing field", ({ revisionZeroHash: _dropped, ...row }) => row],
  ])("a stored opening with %s is unavailable (null)", async (_label, change) => {
    const { journal } = await startedV3(laterV3());
    await tamper(journal, change);
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
  });

  it("an opening no longer describing its record is unavailable (null)", async () => {
    const { journal } = await startedV3();
    const snapshots = raw(journal).table("snapshots");
    const snapshot = await snapshots.get(DOC);
    // The record's snapshot rewritten as v1 under the v3 opening.
    await snapshots.put({ ...snapshot, document: JSON.parse(REVISION_ZERO_JCS) });
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
    await snapshots.put(snapshot);
    expect(await journal.readVerifiedWork(DOC)).not.toBeNull();
    // A record without its meta or chain head opens nothing either.
    const meta = await raw(journal).table("meta").get(DOC);
    await raw(journal).table("meta").put({ ...meta, evidenceHead: undefined });
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
    await raw(journal).table("meta").delete(DOC);
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
  });

  it("a record made before version 5 (no stored opening) is unavailable, as before", async () => {
    const { journal } = await startedV3();
    await works(journal).delete(DOC);
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
  });

  it("adoptServerEvidence keeps the newer opening; deleting the record after submission deletes it", async () => {
    const { journal, work } = await startedV3();
    await raw(journal).table("meta").update(DOC, { state: "CONFLICT" });
    const later = laterV3();
    const fresh = (await verifyWorkOpening(DOC, later, { documentId: DOC, sha256: REVISION_ZERO_V3_SHA256 }))!;
    await journal.adoptServerEvidence(DOC, later, true, LATER, 0, fresh);
    const read = await journal.readVerifiedWork(DOC);
    sameWork(read, fresh);
    expect(read!.revision).not.toBe(work.revision);
    expect(await works(journal).get(DOC)).toMatchObject({ currentRevision: 7, verifiedAt: LATER });
    await journal.discardAfterSubmission(DOC);
    expect(await works(journal).count()).toBe(0);
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
  });
});

describe("PIL-K-V3-BEZ-MREZE: a v1 record stays byte for byte as before", () => {
  it("golden: startEvidence without an opening writes the same rows and no opening", async () => {
    const journal = kit.open();
    await journal.startEvidence(DOC, opening(REVISION_ZERO_JCS), UTC);
    const db = raw(journal);
    expect(await works(journal).count()).toBe(0);
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
    const meta = await db.table("meta").get(DOC);
    const snapshot = await db.table("snapshots").get(DOC);
    expect(Object.keys(meta)).toEqual(["documentId", "localSeq", "state", "evidenceHead", "evidenceProfileId"]);
    expect(canonicalizeJcs(meta)).toBe(
      `{"documentId":"${DOC}","evidenceHead":{"lastSequenceTo":0,"segmentHash":null},` +
      `"evidenceProfileId":"${PROFILE}","localSeq":0,"state":"LOCAL_DURABLE"}`,
    );
    expect(Object.keys(snapshot)).toEqual(["documentId", "revision", "document", "savedAt"]);
    expect(canonicalizeJcs({ ...snapshot, document: null })).toBe(
      `{"document":null,"documentId":"${DOC}","revision":0,"savedAt":"${UTC}"}`,
    );
    expect(canonicalizeJcs(snapshot.document)).toBe(REVISION_ZERO_JCS);
    expect(sha256(encoder.encode(canonicalizeJcs(snapshot.document)))).toBe(REVISION_ZERO_SHA256);
  });
});

describe("PIL-K-V3-BEZ-MREZE: the upgrade to version 5 loses nothing", () => {
  it("a version 4 database with v1 and v3 records opens at version 5 with every row as it was", async () => {
    // A v3 record made by the version 4 journal: its rows, read back raw.
    const { journal: source } = await startedV3();
    const v3 = {
      meta: await raw(source).table("meta").get(DOC), snapshot: await raw(source).table("snapshots").get(DOC),
    };
    const scope = `a${"f".repeat(63)}`;
    const old = new Dexie(`ductus-journal-v1-${scope}`, deps);
    old.version(1).stores({ snapshots: "documentId", pending: "[documentId+localSeq],documentId", meta: "documentId" });
    old.version(2).stores({ control: "key" });
    old.version(3).stores({ timings: "segmentHash,documentId" });
    old.version(4).stores({ salvage: "++id,documentId" });
    const v1Doc = JSON.parse(REVISION_ZERO_JCS);
    const v1Meta = { documentId: "stari-v1", localSeq: 0, state: "LOCAL_DURABLE", evidenceHead: { segmentHash: null, lastSequenceTo: 0 }, evidenceProfileId: PROFILE };
    await old.table("snapshots").bulkPut([{ documentId: "stari-v1", revision: 0, document: v1Doc, savedAt: UTC }, v3.snapshot]);
    await old.table("meta").bulkPut([v1Meta, v3.meta]);
    await old.table("salvage").add({ documentId: "stari-v1", document: v1Doc, cause: "CONFLICT", localSeq: 0, decidedAt: UTC });
    await old.table("timings").put({ segmentHash: "b".repeat(64), documentId: "stari-v1", sequenceFrom: 1, events: [] });
    const before = {
      snapshots: await old.table("snapshots").toArray(), meta: await old.table("meta").toArray(),
      salvage: await old.table("salvage").toArray(), timings: await old.table("timings").toArray(),
    };
    old.close();

    const journal = kit.open(scope);
    expect(await journal.readEvidence("stari-v1")).toMatchObject({ meta: v1Meta, pending: [] });
    const db = raw(journal);
    expect(db.verno).toBe(5);
    expect({
      snapshots: await db.table("snapshots").toArray(), meta: await db.table("meta").toArray(),
      salvage: await db.table("salvage").toArray(), timings: await db.table("timings").toArray(),
    }).toEqual(before);
    expect(await works(journal).count()).toBe(0);
    // The old v3 record has no stored opening: unavailable without the server, as before.
    expect(await journal.readVerifiedWork(DOC)).toBeNull();
    // Its next verified open stores one, and from then on it opens offline.
    const work = (await verifyWorkOpening(DOC, opening(REVISION_ZERO_V3_JCS)))!;
    await journal.startEvidence(DOC, opening(REVISION_ZERO_V3_JCS), LATER, work);
    sameWork(await journal.readVerifiedWork(DOC), work);
  });

  it("a v2 opening is kept and read back as v2, never as v3", async () => {
    const opened = opening(REVISION_ZERO_V2_JCS);
    const work = (await verifyWorkOpening(DOC, opened))!;
    const journal = kit.open();
    await journal.startEvidence(DOC, opened, UTC, work);
    const read = await journal.readVerifiedWork(DOC);
    expect(read?.schemaVersion).toBe(2);
    expect(await works(journal).get(DOC)).toMatchObject({ schemaVersion: 2, revisionZeroHash: REVISION_ZERO_V2_SHA256 });
  });
});
