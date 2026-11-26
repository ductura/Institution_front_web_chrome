import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";

import type { OpenOutcome, OpenedWork } from "@/client/evidence-ingest";
import { readLogoutHold } from "@/client/logout-hold";
import { hasEnded, observeSession, type MarkStore } from "@/client/session-marks";
import { emptyDocument, type DocumentTransaction } from "@/domain/document";
import { AtomicDexieJournal } from "@/lib/journal/atomic-dexie-journal";

import type { ScopeRead } from "./EditorPage.scope";
import { blockedLastSavedText } from "./blocked-notice";
import { openReadOf, readWork, type WorkReaders } from "./EditorPageWork";

// WEB-14b/14c: what the page does with the person's journal scope and each
// answer of evidence.open.post. Invented people, works and text only.
const SCOPE = "b".repeat(64);
const SESSION = { tag: "izmisljena-sesija-0001", at: 1_000 };
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
    expect(openReadOf({ status: "opened", work: work(DOC_A) }, SCOPE, SESSION)).toEqual({ kind: "ready", documentId: DOC_A, scope: SCOPE, session: SESSION });
  });

  it("hands the server-confirmed schema version on, and nothing when the server states none", () => {
    expect(openReadOf({ status: "opened", work: { ...work(DOC_A), schemaVersion: 3 } }, SCOPE, SESSION)).toMatchObject({ kind: "ready", schemaVersion: 3 });
    expect(openReadOf({ status: "opened", work: work(DOC_A) }, SCOPE, SESSION)).not.toHaveProperty("schemaVersion");
  });

  it("hands the server's minute of the last signed save on, and nothing without one (ED-22)", () => {
    const at = "2026-11-26T13:32:00.000Z";
    expect(openReadOf({ status: "opened", work: { ...work(DOC_A), lastSignedAt: at } }, SCOPE, SESSION)).toMatchObject({ kind: "ready", lastSignedAt: at });
    expect(openReadOf({ status: "opened", work: work(DOC_A) }, SCOPE, SESSION)).not.toHaveProperty("lastSignedAt");
  });

  it("says the last save on the server in Zagreb time (ED-22)", () => {
    expect(blockedLastSavedText("2026-11-26T13:32:00.000Z")).toBe("Zadnje spremanje na poslužitelju: 26. studenoga 2026. u 14:32.");
  });

  // ED-01b: each answer names its own cause, so the sheet can offer its own way out.
  it.each([
    [{ status: "unauthenticated" }, "signedOut"],
    [{ status: "not_found" }, "missing"],
    [{ status: "not_accepting" }, "closed"],
    [{ status: "upgrade_required" }, "reload"],
    [{ status: "unavailable" }, "server"],
    [{ status: "unavailable", offline: true }, "offline"],
  ] as const)("%j mounts no editor (%s)", (outcome, failure) => {
    expect(openReadOf(outcome as OpenOutcome, SCOPE, SESSION)).toEqual({ kind: "failed", failure });
  });
});

describe("readWork (fail closed on the scope)", () => {
  it("reads the scope, then opens the work", async () => {
    const r = readers({ kind: "scope", scope: SCOPE, session: SESSION });
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "ready", documentId: DOC_A, scope: SCOPE, session: SESSION });
    expect(r.open).toHaveBeenCalledWith("zadatak-a");
  });

  it.each([
    [{ kind: "noScope" }, "signedOut"],
    [{ kind: "unavailable" }, "server"],
    [{ kind: "unavailable", offline: true }, "offline"],
    [{ kind: "signedOut" }, "signedOut"],
  ] as const)("%j opens nothing, not even the evidence session (%s)", async (scope, failure) => {
    const r = readers(scope);
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "failed", failure });
    expect(r.open).not.toHaveBeenCalled();
  });

  it("a scope read that throws opens nothing", async () => {
    const r = { ...readers({ kind: "scope", scope: SCOPE, session: SESSION }), readScope: vi.fn(async (): Promise<ScopeRead> => { throw new Error("izmišljeni kvar"); }) };
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "failed", failure: "server" });
    expect(r.open).not.toHaveBeenCalled();
  });

  it("an open that throws is a server fault", async () => {
    const r = { ...readers({ kind: "scope", scope: SCOPE, session: SESSION }), open: vi.fn(async (): Promise<OpenOutcome> => { throw new Error("izmišljeni kvar"); }) };
    expect(await readWork("zadatak-a", r)).toEqual({ kind: "failed", failure: "server" });
  });
});

describe("the session mark (SRV-ST)", () => {
  function memory(): MarkStore {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it("the mark of the opened work ends once another sign-in is observed, and not before", async () => {
    const read = await readWork("zadatak-a", readers({ kind: "scope", scope: SCOPE, session: SESSION }));
    if (read.kind !== "ready") throw new Error("the work should open");
    const store = memory();
    observeSession(store, read.session.tag, read.session.at);
    expect(hasEnded(store, read.session, null)).toBe(false);
    observeSession(store, "druga-izmisljena-sesija", read.session.at + 1);
    expect(hasEnded(store, read.session, null)).toBe(true);
  });

  it("the page observes the mark and hands it to the provider", () => {
    const code = readFileSync(new URL("./EditorPageWork.tsx", import.meta.url), "utf8");
    expect(code).toMatch(/<SessionObserver tag=\{read\.session\.tag\} at=\{read\.session\.at\} \/>/);
    expect(code).toMatch(/<LocalDocumentProvider [^>]*session=\{read\.session\}/);
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
    const r = readers({ kind: "scope", scope: SCOPE, session: SESSION }, { "zadatak-a": DOC_A, "zadatak-b": DOC_B });
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
