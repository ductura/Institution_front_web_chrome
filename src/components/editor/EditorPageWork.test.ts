import { afterEach, describe, expect, it, vi } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";

import type { OpenOutcome, OpenedWork } from "@/client/evidence-ingest";
import { readLogoutHold } from "@/client/logout-hold";
import { emptyDocument, type DocumentTransaction } from "@/domain/document";
import { AtomicDexieJournal } from "@/lib/journal/atomic-dexie-journal";

import type { ScopeRead } from "./EditorPage.scope";
import { openReadOf, readWork, type WorkReaders } from "./EditorPageWork";

// WEB-14b/14c: what the page does with the person's journal scope and each
// answer of evidence.open.post. Invented people, works and text only.
const SCOPE = "b".repeat(64);
const DOC_A = "11111111-1111-4111-8111-1111111111aa";
const DOC_B = "11111111-1111-4111-8111-1111111111bb";
const work = (documentId: string) => ({ documentId }) as OpenedWork;

function readers(scope: ScopeRead, works: Record<string, string> = { "zadatak-a": DOC_A }) {
  const open = vi.fn(async (assignmentId: string): Promise<OpenOutcome> => {
    const documentId = works[assignmentId];
    return documentId ? { status: "opened", work: work(documentId) } : { status: "not_found" };
  });
  return { readScope: vi.fn(async () => scope), open } satisfies WorkReaders;
}

describe("openReadOf", () => {
  it("opens the opened work under the person's scope", () => {
    expect(openReadOf({ status: "opened", work: work(DOC_A) }, SCOPE)).toEqual({ kind: "ready", documentId: DOC_A, scope: SCOPE });
  });

  it.each([
    ["unauthenticated", "signedOut"],
    ["not_found", "closed"],
    ["not_accepting", "closed"],
    ["upgrade_required", "reload"],
    ["unavailable", "unavailable"],
  ] as const)("%s mounts no editor (%s)", (status, kind) => {
    expect(openReadOf({ status } as OpenOutcome, SCOPE)).toEqual({ kind });
  });
});

describe("readWork (fail closed on the scope)", () => {
  it("reads the scope, then opens the work", async () => {
    const r = readers({ kind: "scope", scope: SCOPE });
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "ready", documentId: DOC_A, scope: SCOPE });
    expect(r.open).toHaveBeenCalledWith("zadatak-a");
  });

  it.each([
    [{ kind: "noScope" }, "unavailable"],
    [{ kind: "unavailable" }, "unavailable"],
    [{ kind: "signedOut" }, "signedOut"],
  ] as const)("%j opens nothing, not even the evidence session (%s)", async (scope, kind) => {
    const r = readers(scope);
    expect(await readWork("zadatak-a", r)).toEqual({ kind });
    expect(r.open).not.toHaveBeenCalled();
  });

  it("a scope read that throws opens nothing", async () => {
    const r = { ...readers({ kind: "scope", scope: SCOPE }), readScope: vi.fn(async (): Promise<ScopeRead> => { throw new Error("izmišljeni kvar"); }) };
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "unavailable" });
    expect(r.open).not.toHaveBeenCalled();
  });

  it("an open that throws is unavailable", async () => {
    const r = { ...readers({ kind: "scope", scope: SCOPE }), open: vi.fn(async (): Promise<OpenOutcome> => { throw new Error("izmišljeni kvar"); }) };
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "unavailable" });
  });
});

describe("one person, two works: one journal", () => {
  const idb = { indexedDB, IDBKeyRange };
  afterEach(() => vi.unstubAllGlobals());

  function tx(id: string): DocumentTransaction {
    return {
      kind: "REPLACE_DOCUMENT",
      clientTransactionId: id,
      baseRevision: 0,
      createdAt: "2026-11-19T22:00:00.000Z",
      document: emptyDocument(() => "aaaaaaaa-0000-4000-8000-000000000001"),
    };
  }

  it("both works open under the same scope, and the sign-out summary counts both", async () => {
    vi.stubGlobal("indexedDB", indexedDB);
    const r = readers({ kind: "scope", scope: SCOPE }, { "zadatak-a": DOC_A, "zadatak-b": DOC_B });
    const a = await readWork("zadatak-a", r);
    const b = await readWork("zadatak-b", r);
    if (a.kind !== "ready" || b.kind !== "ready") throw new Error("both works should open");
    expect(a.scope).toBe(b.scope);
    expect(a.documentId).not.toBe(b.documentId);

    const journalA = new AtomicDexieJournal(a.scope, idb);
    const journalB = new AtomicDexieJournal(b.scope, idb);
    try {
      await journalA.saveLocal(a.documentId, tx("rad-a"), "2026-11-19T22:00:00.000Z", 0);
      await journalB.saveLocal(b.documentId, tx("rad-b"), "2026-11-19T22:00:01.000Z", 0);
      const held = await readLogoutHold(SCOPE, { peek: (s) => AtomicDexieJournal.peekLogoutHold(s, idb), store: null });
      expect(held).toEqual({ pending: 2, copies: 0, kept: true });
      // Another person's scope holds nothing of these works.
      const other = await readLogoutHold("c".repeat(64), { peek: (s) => AtomicDexieJournal.peekLogoutHold(s, idb), store: null });
      expect(other).toEqual({ pending: 0, copies: 0, kept: false });
    } finally {
      journalA.close();
      journalB.close();
    }
  });
});
