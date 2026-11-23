// @vitest-environment node
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import type { OpenedWork, OpenOutcome } from "@/client/evidence-ingest";
import { browserEvidenceSessionDeps, drainJournalFor } from "@/client/evidence-session-deps";
import type { CanonicalDocument, CanonicalDocumentV3 } from "@/domain/document";
import {
  REVISION_ZERO_JCS, REVISION_ZERO_SHA256, REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256, revisionZeroDocument, revisionZeroDocumentV3,
} from "@/domain/document/revision-zero";
import { replayEvidenceSegmentsV2 } from "@/domain/forensics/evidence-replay-v2";
import { canonicalizeJcs, type JcsJsonValue } from "@/domain/forensics/jcs";
import { createBrowserEditStepsV1Replayer } from "@/domain/forensics/replay/edit-steps-v1-browser-replayer";
import { createBrowserAcademicReplayer } from "@/domain/forensics/replay/edit-steps-versioned-browser-replayer";
import { verifyWorkOpening } from "@/domain/serverSync/work-opening";
import type { QueuedTransaction } from "@/domain/sync/journal-types";
import {
  canonicalToTiptap, canonicalToTiptapV3, createEditorExtensions, createEditorExtensionsV3, sheetSchemaVersion, tiptapToCanonical,
} from "@/editor";
import type { AtomicDexieJournal } from "@/lib/journal/atomic-dexie-journal";
import { createDrainRunner } from "@/lib/sync/drain-runner";
import { createEvidenceTransport, evidenceVerifierFor } from "@/lib/sync/evidence-transport";
import { DOC, DOMAIN, journalKit, PROFILE, server, sha256, trusted } from "@/lib/sync/evidence-test-kit";

import { EvidenceSession, type EvidenceSessionDeps, type SheetDocument } from "./evidence-session";
import { loadStored, sheetCandidate } from "./LocalDocument";

/**
 * PIL-K-SPREMANJE-V3: the save path of a work whose confirmed schema is v3,
 * over the real recorder on a headless v3 editor, a journal on
 * fake-indexeddb, the real v3 browser replayer and the kit's commit route,
 * receipts signed with an invented key. Every id, key and text is invented.
 */

const { open: openJournal, cleanup } = journalKit("e");
const editors: Editor[] = [];
afterEach(async () => {
  for (const editor of editors.splice(0)) editor.destroy();
  await cleanup();
});

const encoder = new TextEncoder();
const FOOTNOTE = "Izmišljena bilješka o izvoru.";

/** The open answer for revision zero of `version`, as the server states it. */
function revisionZero(version: 1 | 3, over: Partial<OpenedWork> = {}): OpenedWork {
  const [jcs, hash] = version === 3 ? [REVISION_ZERO_V3_JCS, REVISION_ZERO_V3_SHA256] : [REVISION_ZERO_JCS, REVISION_ZERO_SHA256];
  return {
    documentId: DOC, evidenceProfileId: PROFILE, currentRevision: 0, documentHash: hash, headSegmentHash: null,
    lastSequenceTo: 0, document: encoder.encode(jcs), evidenceDomainId: DOMAIN, receiptKeys: [trusted.key], submitted: false,
    schemaVersion: version, ...over,
  };
}

function offline() {
  return { online: () => false, onOnline: () => () => {} };
}

/** A session as `createDocumentSaver` makes it for the sheet's schema, with its clock and ids fixed. */
function sessionFor(journal: AtomicDexieJournal, schema: 1 | 3, work: OpenedWork, over: Partial<EvidenceSessionDeps> = {}) {
  let id = 0;
  return new EvidenceSession({
    journal,
    documentId: DOC,
    open: async (): Promise<OpenOutcome> => ({ status: "opened", work }),
    replayer: schema === 3 ? () => createBrowserAcademicReplayer(3) : createBrowserEditStepsV1Replayer,
    createRunner: (opened, verified) => createDrainRunner<QueuedTransaction>({
      journal: verified ? drainJournalFor(journal, verified) : journal,
      transport: createEvidenceTransport(server(0).fetchImpl, undefined, verified),
      verifyFor: evidenceVerifierFor(opened),
    }),
    network: offline(),
    now: () => new Date("2026-11-23T09:00:00.000Z"),
    newId: () => `aaaaaaaa-0000-4000-8000-${(id += 1).toString(16).padStart(12, "0")}`,
    ...(schema === 3 ? { schemaVersion: 3 as const } : {}),
    ...over,
  });
}

/** A headless sheet of `schema` holding `doc`, its changes recorded as LocalDocument records them. */
function sheetFor(session: EvidenceSession, schema: 1 | 3, doc: SheetDocument) {
  const editor = new Editor({
    element: null,
    extensions: schema === 3 ? createEditorExtensionsV3() : createEditorExtensions(),
    content: schema === 3 ? canonicalToTiptapV3(doc as CanonicalDocumentV3) : canonicalToTiptap(doc as CanonicalDocument),
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  editors.push(editor);
  let at = Date.parse("2026-11-23T09:00:00.000Z");
  editor.on("transaction", ({ transaction, appendedTransactions }) => {
    session.record([transaction, ...appendedTransactions], undefined, (at += 100));
  });
  const type = (text: string) => editor.view.dispatch(editor.state.tr.insertText(text));
  const footnote = (text: string) =>
    editor.view.dispatch(editor.state.tr.replaceSelectionWith(editor.schema.nodes.footnote!.create({ text })));
  const save = async () => {
    const candidate = sheetCandidate(editor, schema);
    if (!candidate) throw new Error("the sheet cannot be stored");
    session.edit();
    await session.propose(candidate.doc);
    await session.settled();
    return candidate.doc;
  };
  return { editor, type, footnote, save };
}

async function ready(session: EvidenceSession) {
  const result = await session.load();
  if (result.kind !== "ready") throw new Error(`load: ${result.kind}`);
  return result.document;
}

describe("PIL-K-SPREMANJE-V3: which schema the sheet takes", () => {
  it("v3 only for a confirmed 3; an absent, unknown or other version is v1", () => {
    expect(sheetSchemaVersion(3)).toBe(3);
    for (const other of [undefined, null, 1, 2, 4, "3", 3.5, Number.NaN]) expect(sheetSchemaVersion(other)).toBe(1);
  });

  it("the browser adapters keep the v1 replayer unless the sheet is v3", () => {
    const journal = openJournal();
    const v1 = browserEvidenceSessionDeps({ journal, documentId: DOC, assignmentId: "zadatak-izmisljeni", current: () => true });
    expect(v1.replayer().transactionFormat).toBe("ductus-edit-steps-v1");
    expect(v1).not.toHaveProperty("schemaVersion");
    const v3 = browserEvidenceSessionDeps({ journal, documentId: DOC, assignmentId: "zadatak-izmisljeni", current: () => true, schemaVersion: 3 });
    expect(v3.replayer().transactionFormat).toBe("ductus-edit-steps-v3");
    expect(v3.schemaVersion).toBe(3);
  });

  it("a v3 session never opens on an answer that does not confirm v3", async () => {
    for (const work of [revisionZero(1), revisionZero(3, { schemaVersion: undefined }), revisionZero(3, { currentRevision: 2 })]) {
      const journal = openJournal();
      const session = sessionFor(journal, 3, work);
      expect(await session.load()).toEqual({ kind: "unavailable" });
      expect(session.snapshot().failure).toBe("unavailable");
      // Nothing was written for a work the session could not verify.
      expect((await journal.readEvidence(DOC)).meta).toBeNull();
    }
  });
});

describe("PIL-K-SPREMANJE-V3: a v3 work saves and opens again", () => {
  it("(1) a work with a footnote is saved and loads again without TIPTAP_UNKNOWN_NODE_TYPE", async () => {
    const journal = openJournal();
    const session = sessionFor(journal, 3, revisionZero(3));
    const sheet = sheetFor(session, 3, await ready(session));
    sheet.type("Uvod");
    sheet.footnote(FOOTNOTE);
    const saved = await sheet.save();
    expect(session.snapshot()).toMatchObject({ state: "LOCAL_DURABLE", stopped: false, failure: null });
    expect(saved).toMatchObject({ schemaVersion: 3, nodes: [{ children: [{ type: "text", text: "Uvod" }, { type: "footnote", text: FOOTNOTE }] }] });
    // The v1 projection the sheet used before refuses the footnote.
    const v1 = tiptapToCanonical(sheet.editor.getJSON());
    expect(v1.ok ? [] : v1.errors.map((error) => error.code)).toContain("TIPTAP_UNKNOWN_NODE_TYPE");

    const verified = (await verifyWorkOpening(DOC, revisionZero(3)))!;
    const stored = await journal.readEvidence(DOC, verified);
    expect(canonicalizeJcs(stored.snapshot!.document)).toBe(canonicalizeJcs(saved));

    // A reload: a new session over the same journal and a new v3 sheet.
    const again = sessionFor(journal, 3, revisionZero(3));
    const loaded = await ready(again);
    expect(canonicalizeJcs(loaded)).toBe(canonicalizeJcs(saved));
    const reopened = new Editor({ element: null, extensions: createEditorExtensionsV3(), content: canonicalToTiptapV3(revisionZeroDocumentV3()) });
    editors.push(reopened);
    expect(loadStored(reopened, loaded, 3)).toBe(true);
    const shown = sheetCandidate(reopened, 3);
    expect(shown && canonicalizeJcs(shown.doc)).toBe(canonicalizeJcs(saved));
    expect(shown?.words).toBe(1);
    // The v1 sheet refuses the stored v3 document instead of dropping the footnote.
    const v1Sheet = new Editor({ element: null, extensions: createEditorExtensions(), content: canonicalToTiptap(revisionZeroDocument()) });
    editors.push(v1Sheet);
    expect(loadStored(v1Sheet, loaded, 1)).toBe(false);
  });

  it("(2) the evidence of the footnote step replays for the v3 work", async () => {
    const journal = openJournal();
    const session = sessionFor(journal, 3, revisionZero(3));
    const sheet = sheetFor(session, 3, await ready(session));
    sheet.footnote(FOOTNOTE);
    const saved = await sheet.save();
    const verified = (await verifyWorkOpening(DOC, revisionZero(3)))!;
    const { pending } = await journal.readEvidence(DOC, verified);
    expect(pending).toHaveLength(1);
    const segment = JSON.parse(new TextDecoder().decode(pending[0]!.tx.segment)) as {
      captureContext: { transactionFormat: string }; finalDocumentHash: string;
      events: { steps: { slice?: { content?: { type: string }[] } }[] }[];
    };
    expect(segment.captureContext.transactionFormat).toBe("ductus-edit-steps-v3");
    expect(JSON.stringify(segment.events)).toContain("\"footnote\"");
    const replay = await replayEvidenceSegmentsV2(
      revisionZeroDocumentV3() as unknown as JcsJsonValue, [segment as never], createBrowserAcademicReplayer(3));
    expect(replay).toMatchObject({ ok: true, documentSha256: segment.finalDocumentHash });
    expect(sha256(encoder.encode(canonicalizeJcs(saved)))).toBe(segment.finalDocumentHash);
    // The v1 replayer is not the replayer of this work.
    const v1 = await replayEvidenceSegmentsV2(
      revisionZeroDocumentV3() as unknown as JcsJsonValue, [segment as never], createBrowserEditStepsV1Replayer());
    expect(v1.ok).toBe(false);
  });

  it("the drain sends the v3 row and verifies its receipt under the v3 work", async () => {
    const journal = openJournal();
    const net = server(0);
    let up = false;
    const listeners = new Set<() => void>();
    const session = sessionFor(journal, 3, revisionZero(3), {
      createRunner: (opened, verified) => createDrainRunner<QueuedTransaction>({
        journal: verified ? drainJournalFor(journal, verified) : journal,
        transport: createEvidenceTransport(net.fetchImpl, undefined, verified),
        verifyFor: evidenceVerifierFor(opened),
        now: () => 0, jitter: () => 0.5,
      }),
      network: { online: () => up, onOnline: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } },
    });
    const sheet = sheetFor(session, 3, await ready(session));
    sheet.footnote(FOOTNOTE);
    await sheet.save();
    up = true;
    for (const listener of [...listeners]) listener();
    await session.settled();
    expect(net.calls).toHaveLength(1);
    expect(session.snapshot()).toMatchObject({ state: "SYNCED", receiptVerified: true });
    expect(await session.heldRows()).toBe(0);
  });
});

describe("PIL-K-SPREMANJE-V3: (3) a v1 work stays as it was", () => {
  // Captured from the same flow on migracija/kopija-ductus-front ab383c8, before this change.
  const GOLDEN = {
    segmentHash: "9aacc421ab3bcf234f20006075accf293e6dec2292444a7ef9c365a44aea26db",
    document: '{"nodes":[{"children":[{"marks":[],"text":"Uvod u izmišljeni rad","type":"text"}],"id":"00000000-0000-4000-8000-000000000000","type":"paragraph"}],"schemaVersion":1}',
  };

  it("the same journal row and snapshot, byte for byte", async () => {
    const journal = openJournal();
    const session = sessionFor(journal, 1, revisionZero(1, { schemaVersion: undefined }));
    const loaded = await ready(session);
    expect(canonicalizeJcs(loaded)).toBe(canonicalizeJcs(revisionZeroDocument()));
    const sheet = sheetFor(session, 1, loaded);
    sheet.type("Uvod u izmišljeni rad");
    await sheet.save();
    const stored = await journal.readEvidence(DOC);
    expect(stored.pending).toHaveLength(1);
    expect(stored.pending[0]!.tx.segmentHash).toBe(GOLDEN.segmentHash);
    expect(sha256(stored.pending[0]!.tx.segment)).toBe(GOLDEN.segmentHash);
    expect(canonicalizeJcs(stored.snapshot!.document)).toBe(GOLDEN.document);
    expect(stored.snapshot!.document.schemaVersion).toBe(1);
  });

  it("a confirmed 1 and an unconfirmed version build the v1 sheet's candidate", () => {
    const editor = new Editor({ element: null, extensions: createEditorExtensions(), content: canonicalToTiptap(revisionZeroDocument()) });
    editors.push(editor);
    const candidate = sheetCandidate(editor, sheetSchemaVersion(undefined));
    const direct = tiptapToCanonical(editor.getJSON());
    expect(direct.ok && candidate && canonicalizeJcs(candidate.doc)).toBe(direct.ok && canonicalizeJcs(direct.doc));
    expect(candidate?.doc.schemaVersion).toBe(1);
  });
});
