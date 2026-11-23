// @vitest-environment node
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OpenedWork } from "@/client/evidence-ingest";
import { decodeBase64 } from "@/client/evidence-ingest";
import { EvidenceSession } from "@/components/editor/evidence-session";
import { createBrowserEditStepsV1Replayer } from "@/domain/forensics/replay/edit-steps-v1-browser-replayer";
import type { CanonicalDocument } from "@/domain/document";
import { canonicalizeJcs, jcsUtf8Bytes } from "@/domain/forensics/jcs";
import type { QueuedTransaction } from "@/domain/sync/journal-types";
import { canonicalToTiptap, createEditorExtensions, tiptapToCanonical } from "@/editor";
import { createDrainRunner } from "@/lib/sync/drain-runner";
import { createEvidenceTransport, evidenceVerifierFor } from "@/lib/sync/evidence-transport";
import { DOC, DOMAIN, journalKit, R0, server, sha256, trusted } from "@/lib/sync/evidence-test-kit";

import { restorableDocument } from "./client-port";
import { applyRestoredDocument } from "./restore-editor";

/**
 * PIL-D7-OBNOVA (review c.7087841501, item 1): the restore's own editor command, run on a real editor
 * wired to a real EvidenceSession, journal and drain the way LocalDocument wires them, gives one
 * covered segment and a verified receipt, never `stopped` or a save outside the evidence. The helpers
 * follow src/components/editor/evidence-session.equivalence.test.ts. Every id, key and text is invented.
 *
 * What this test is not: it does not mount LocalDocumentProvider (that needs IndexedDB, Web Locks and
 * a signing server in a browser). It follows the provider's wiring instead: `onUpdate` calls
 * `session.edit()` and schedules the flush, `transaction` calls `session.record`, and the flush builds
 * the canonical candidate and proposes it, but only when an update was reported (`dirty`).
 */

const PROFILE = "profil-izmisljeni";
const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const C = "cccccccc-0000-4000-8000-00000000000c";
const text = (value: string) => [{ type: "text", text: value, marks: [] }];

/** The head (version 3) the editor opens with. */
const CURRENT = canonical({ type: "doc", content: [
  { type: "heading", attrs: { nodeId: A, level: 2 }, content: [{ type: "text", text: "Uvod" }] },
  { type: "paragraph", attrs: { nodeId: B }, content: [{ type: "text", text: "Novi odlomak treće verzije." }] },
] });

/** Version 1 as the server stores it: the heading's old id, and a paragraph id the head no longer has. */
const VERSION_1 = restorableDocument(JSON.stringify({ schemaVersion: 1, nodes: [
  { type: "heading", id: A, level: 2, children: text("Uvod") },
  { type: "paragraph", id: C, children: text("Izmišljeni odlomak prve verzije.") },
] }))!;

/** The document without block ids: the identity plugin (#226) owns ids and may mint a fresh one. */
const withoutIds = (doc: CanonicalDocument) => doc.nodes.map(({ id: _id, ...rest }) => rest);

function canonical(json: object): CanonicalDocument {
  const editor = new Editor({ element: null, extensions: createEditorExtensions(), content: json });
  const doc = tiptapToCanonical(editor.getJSON());
  editor.destroy();
  if (!doc.ok) throw new Error("test document is not canonical");
  return doc.doc;
}

const { open: openJournal, cleanup } = journalKit("7");
const editors: Editor[] = [];
afterEach(async () => {
  for (const editor of editors.splice(0)) editor.destroy();
  await cleanup();
  vi.restoreAllMocks();
});

function workFor(doc: CanonicalDocument): OpenedWork {
  const document = jcsUtf8Bytes(doc);
  return {
    documentId: DOC, evidenceProfileId: PROFILE, currentRevision: R0, documentHash: sha256(document),
    headSegmentHash: null, lastSequenceTo: 0, document, evidenceDomainId: DOMAIN, receiptKeys: [trusted.key], submitted: false,
  };
}

function setup() {
  const journal = openJournal();
  const net = server();
  const session = new EvidenceSession({
    journal,
    documentId: DOC,
    open: async () => ({ status: "opened", work: workFor(CURRENT) }),
    replayer: createBrowserEditStepsV1Replayer,
    createRunner: (work) => createDrainRunner<QueuedTransaction>({
      journal, transport: createEvidenceTransport(net.fetchImpl), verifyFor: evidenceVerifierFor(work),
      now: () => 0, jitter: () => 0.5,
    }),
    network: { online: () => true, onOnline: () => () => undefined },
    clock: () => 0,
    setTimer: () => ({}),
    clearTimer: () => undefined,
  });
  return { session, journal, net };
}

/** A real editor whose every transaction goes to `session.record`, and the provider's save after a change. */
function sheetFor(session: EvidenceSession) {
  const editor = new Editor({ element: null, extensions: createEditorExtensions(), content: canonicalToTiptap(CURRENT) });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  editors.push(editor);
  let at = Date.parse("2026-11-22T09:00:00.000Z");
  let updates = 0;
  editor.on("update", () => { updates += 1; session.edit(); });
  editor.on("transaction", ({ transaction, appendedTransactions }) => {
    session.record([transaction, ...appendedTransactions], undefined, (at += 100));
  });
  /** The provider's flush runs only after `onUpdate`; a command that emits no update proposes nothing. */
  const flush = async () => (updates === 0 ? null : save());
  const save = async () => {
    const candidate = tiptapToCanonical(editor.getJSON());
    if (!candidate.ok) throw new Error("not canonical");
    await session.propose(candidate.doc);
    await session.settled();
    return candidate.doc;
  };
  return { editor, save, flush, updates: () => updates };
}

describe("restore through the editor's save path (PIL-D7-OBNOVA)", () => {
  it("a whole-document restore with old node ids is one covered segment, committed with a verified receipt", async () => {
    const { session, journal, net } = setup();
    expect((await session.load()).kind).toBe("ready");
    await session.settled();
    const saveSegment = vi.spyOn(journal, "saveSegment");
    const saveUncovered = vi.spyOn(journal, "saveUncovered");
    const sheet = sheetFor(session);

    expect(applyRestoredDocument(sheet.editor, VERSION_1)).toBe(true);
    // emitUpdate: the provider's onUpdate fires, so the change is proposed like typing.
    expect(sheet.updates()).toBe(1);
    const saved = (await sheet.flush())!;

    // Version 1's text, block for block. The heading keeps its id; the paragraph's old id is one the
    // head no longer has, and the identity plugin gives it a fresh, unique one.
    expect(withoutIds(saved)).toEqual(withoutIds(VERSION_1));
    expect(saved.nodes[0]!.id).toBe(A);
    expect(new Set(saved.nodes.map((n) => n.id)).size).toBe(saved.nodes.length);
    expect(saveUncovered).not.toHaveBeenCalled();
    expect(saveSegment).toHaveBeenCalledTimes(1);
    const { meta, pending, snapshot } = await journal.readEvidence(DOC);
    expect(meta?.evidenceStopped ?? null).toBeNull();
    expect(pending).toEqual([]);
    expect(canonicalizeJcs(snapshot!.document)).toBe(canonicalizeJcs(saved));

    // One commit on top of the opened head; the document it carries is version 1's text.
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0]!.body.baseRevision).toBe(R0);
    expect(new TextDecoder().decode(decodeBase64(net.calls[0]!.body.document)!)).toBe(canonicalizeJcs(saved));
    const state = session.snapshot();
    expect(state).toMatchObject({ state: "SYNCED", receiptVerified: true, stopped: false, unconfirmed: false });
  });

  it("control: the same change without emitUpdate is never proposed, so nothing is committed", async () => {
    const { session, journal, net } = setup();
    await session.load();
    await session.settled();
    const saveSegment = vi.spyOn(journal, "saveSegment");
    const sheet = sheetFor(session);
    sheet.editor.commands.setContent(canonicalToTiptap(VERSION_1), { emitUpdate: false });
    expect(sheet.updates()).toBe(0);
    // The provider's flush has nothing to send; the real flush path runs and finds the sheet clean.
    expect(await sheet.flush()).toBeNull();
    await session.settled();
    expect(saveSegment).not.toHaveBeenCalled();
    expect(net.calls).toHaveLength(0);
    expect(session.snapshot().state).not.toBe("SYNCED");
    // And the same command with emitUpdate commits: the difference above is the flag, nothing else.
    const other = setup();
    await other.session.load();
    await other.session.settled();
    const again = sheetFor(other.session);
    applyRestoredDocument(again.editor, VERSION_1);
    await again.flush();
    expect(other.net.calls).toHaveLength(1);
  });

  it("a sheet that is not writable takes nothing", async () => {
    const { session } = setup();
    await session.load();
    const sheet = sheetFor(session);
    sheet.editor.setEditable(false, false);
    expect(applyRestoredDocument(sheet.editor, VERSION_1)).toBe(false);
    const shown = tiptapToCanonical(sheet.editor.getJSON());
    expect(shown.ok && canonicalizeJcs(shown.doc)).toBe(canonicalizeJcs(CURRENT));
    expect(sheet.updates()).toBe(0);
  });
});
