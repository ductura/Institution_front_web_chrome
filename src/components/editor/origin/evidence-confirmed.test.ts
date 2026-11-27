import { describe, expect, it, vi } from "vitest";

import type { OpenedWork } from "@/client/evidence-ingest";
import type { DrainStepResult } from "@/lib/sync/drain-runner";

import { EvidenceSession, type ConfirmedRevision, type EvidenceSessionDeps } from "../evidence-session";

/**
 * PM1-R01: the evidence session says which revision the server confirmed, and
 * only when the journal's document is that revision's text. Invented ids only.
 */

const DOCUMENT = "demo-rad-podrijetlo";
const A = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa";
const doc = (text: string) => ({ schemaVersion: 1, nodes: [{ type: "paragraph", id: A, children: [{ type: "text", text, marks: [] }] }] });

type Journal = { snapshot: { documentId: string; revision: number; document: unknown; savedAt: string }; pending: unknown[]; meta: Record<string, unknown> };

function setup(input: { loadedPending?: number; afterStep: (journal: Journal) => void; step: DrainStepResult }) {
  const journal: Journal = {
    snapshot: { documentId: DOCUMENT, revision: 4, document: doc("Izmišljen tekst."), savedAt: "2026-11-27T08:00:00.000Z" },
    pending: Array.from({ length: input.loadedPending ?? 0 }, (_, i) => ({ localSeq: i + 1 })),
    meta: { documentId: DOCUMENT, state: "LOCAL_DURABLE", localSeq: input.loadedPending ?? 0, evidenceHead: { segmentHash: null, sequenceTo: 0 } },
  };
  let stepped = false;
  const step = vi.fn(async (): Promise<DrainStepResult> => {
    if (stepped) return { kind: "idle" };
    stepped = true;
    input.afterStep(journal);
    return input.step;
  });
  const work = { documentId: DOCUMENT, evidenceProfileId: "demo-profil", submitted: false } as unknown as OpenedWork;
  const deps = {
    documentId: DOCUMENT,
    journal: {
      readEvidence: vi.fn(async () => structuredClone(journal)),
      startEvidence: vi.fn(async () => journal.meta),
      saveSegment: vi.fn(),
      saveUncovered: vi.fn(),
    },
    open: async () => ({ status: "opened", work }),
    replayer: () => { throw new Error("not used"); },
    createRunner: () => ({ step }),
    network: { online: () => true, onOnline: () => () => {} },
  } as unknown as EvidenceSessionDeps;
  const session = new EvidenceSession(deps);
  const confirmed: ConfirmedRevision[] = [];
  session.onConfirmed((value) => { confirmed.push(value); });
  return { session, confirmed, step };
}

describe("EvidenceSession.onConfirmed (PM1-R01)", () => {
  it("reports the revision of a verified receipt that left nothing owed, with the journal's document", async () => {
    const { session, confirmed } = setup({
      afterStep: (journal) => { journal.snapshot.revision = 5; journal.snapshot.document = doc("Izmišljen tekst, dopunjen."); journal.meta.state = "SYNCED"; },
      step: { kind: "sent", state: "SYNCED", ackedRevision: 5 },
    });
    await session.load();
    expect(session.loadedRevision()).toBe(4);
    await session.settled();
    expect(confirmed).toEqual([{ revision: 5, document: doc("Izmišljen tekst, dopunjen.") }]);
    session.close();
  });

  it("says nothing while rows are still owed, or when the journal's document is based on another revision", async () => {
    const owed = setup({
      afterStep: (journal) => { journal.snapshot.revision = 5; journal.pending = [{ localSeq: 2 }]; },
      step: { kind: "sent", state: "LOCAL_DURABLE", ackedRevision: 5 },
    });
    await owed.session.load();
    await owed.session.settled();
    expect(owed.confirmed).toEqual([]);
    owed.session.close();

    const other = setup({ afterStep: () => {}, step: { kind: "sent", state: "SYNCED", ackedRevision: 5 } });
    await other.session.load();
    await other.session.settled();
    expect(other.confirmed).toEqual([]);
    other.session.close();

    const refused = setup({ afterStep: (journal) => { journal.snapshot.revision = 5; }, step: { kind: "sent", state: "ERROR", ackedRevision: null } });
    await refused.session.load();
    await refused.session.settled();
    expect(refused.confirmed).toEqual([]);
    refused.session.close();
  });

  it("a load with rows owed is at no revision of the server", async () => {
    const { session } = setup({ loadedPending: 1, afterStep: () => {}, step: { kind: "idle" } });
    await session.load();
    expect(session.loadedRevision()).toBeNull();
    session.close();
  });

  it("a listener that throws never reaches the saving", async () => {
    const { session, confirmed } = setup({
      afterStep: (journal) => { journal.snapshot.revision = 5; journal.meta.state = "SYNCED"; },
      step: { kind: "sent", state: "SYNCED", ackedRevision: 5 },
    });
    session.onConfirmed(() => { throw new Error("listener"); });
    await session.load();
    await expect(session.settled()).resolves.toBeUndefined();
    expect(confirmed.map((value) => value.revision)).toEqual([5]);
    session.close();
  });
});
