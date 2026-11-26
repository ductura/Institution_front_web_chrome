"use client";

// WEB-V13-DNEVNIK-SINKRONIZACIJA: the hook the slides work page mounts. It reads
// the person's journal scope, takes this tab's Web Lock for the work (a second
// tab is blocked and saves nothing), opens the journal and the evidence and
// gives the page the document, the save state and `onSteps` for the editor.
// The adapters are the text editor's own (evidence-ingest, drain runner,
// receipt verification under the keys of the opened work, the browser's
// network signal): only the step format and the document differ.
import { useEffect, useMemo, useRef, useState } from "react";

import { browserTransport } from "../../../../../../src/client/api.ts";
import { createCommitProtocol, openWork, type FetchLike, type OpenedWork } from "../../../../../../src/client/evidence-ingest.ts";
import { guardedFetch, watchClosedBySubmission } from "../../../../../../src/client/evidence-session-deps.ts";
import { readOnline } from "../../../../../../src/client/online-status.ts";
import { browserMarkStore, hasEnded, SESSION_END_CHANNEL, type SessionMark } from "../../../../../../src/client/session-marks.ts";
import { readJournalScope } from "../../../../../../src/components/editor/EditorPage.scope.ts";
import { AtomicDexieJournal } from "../../../../../editor-core/src/journal/atomic-dexie-journal.ts";
import type { VerifiedWorkOpening } from "../../../../../editor-core/src/serverSync/work-opening.ts";
import type { SlidesDocument } from "../../../../../editor-core/src/slides/model.ts";
import type { SlideStep } from "../../../../../editor-core/src/slides/steps.ts";
import type { QueuedTransaction } from "../../../../../editor-core/src/sync/journal-types.ts";
import { createDrainRunner, type DrainJournal } from "../../../../../editor-core/src/sync/runner/drain-runner.ts";
import { createEvidenceTransport, evidenceVerifierFor } from "../../../../../editor-core/src/sync/runner/evidence-transport.ts";
import type { AdoptResult, SlidesSaverDeps, SlidesSnapshot } from "./slides-saver.ts";
import { SlidesSaver } from "./slides-saver.ts";

/** One `Ductus-Protocol` state for the life of the tab, as the text editor keeps it. */
const tabCommitProtocol = createCommitProtocol();

/** The drain's journal for a slides work: its rows are read under the verified opening. */
function drainJournalFor(journal: AtomicDexieJournal, verified: VerifiedWorkOpening): DrainJournal {
  return {
    beginSend: (documentId, sent) => journal.beginSend(documentId, sent),
    recordAnswer: (documentId, sent, outcome, state) => journal.recordAnswer(documentId, sent, outcome, state),
    read: (documentId) => journal.readEvidence(documentId, verified) as ReturnType<DrainJournal["read"]>,
  } as DrainJournal;
}

export type BrowserSlidesInput = {
  journal: AtomicDexieJournal;
  documentId: string;
  assignmentId: string;
  /** Whether this tab's sign-in is still the browser's; asked before each request. */
  current: () => boolean;
  fetchImpl?: FetchLike;
  source?: Parameters<typeof readOnline>[0];
};

/** The adapters of `SlidesSaver` for the browser. */
export function browserSlidesDeps(input: BrowserSlidesInput): SlidesSaverDeps {
  const fetchImpl = guardedFetch(input.fetchImpl ?? browserTransport, input.current);
  const source = input.source ?? globalThis.window;
  const open = () => openWork(input.assignmentId, fetchImpl);
  const closed = watchClosedBySubmission(fetchImpl, async () => {
    const outcome = await open();
    return outcome.status === "opened" && outcome.work.submitted;
  });
  return {
    journal: input.journal,
    documentId: input.documentId,
    open,
    createRunner: (work: OpenedWork, verified) => createDrainRunner<QueuedTransaction>({
      journal: drainJournalFor(input.journal, verified),
      transport: createEvidenceTransport(closed.fetchImpl, tabCommitProtocol, verified),
      verifyFor: evidenceVerifierFor(work),
    }),
    watchSubmission: closed.watch,
    network: {
      online: () => readOnline(source),
      onOnline: (listener) => {
        source.addEventListener("online", listener);
        return () => source.removeEventListener("online", listener);
      },
    },
  };
}

export type SlidesSession =
  | { phase: "loading" }
  /** Another tab holds this work: this tab saves nothing and says so. */
  | { phase: "blocked" }
  /** No valid sign-in scope, no browser storage, or the work is not a readable slides work. */
  | { phase: "unavailable" }
  | { phase: "signed-out" }
  | { phase: "recovery"; document: SlidesDocument | null; state: SlidesSnapshot["state"]; adopt: (confirmed: boolean) => Promise<AdoptResult> }
  | {
      phase: "ready"; document: SlidesDocument; readOnly: boolean; snapshot: SlidesSnapshot;
      onSteps: (steps: SlideStep[], after: SlidesDocument) => void;
    };

const noBrowserStorage = () =>
  typeof navigator === "undefined" || !navigator.locks || typeof indexedDB === "undefined" || !indexedDB;

/**
 * Opens the slides session of one work. `attempt` changes when the page asks to
 * try again. Everything it starts is stopped on unmount.
 */
export function useSlidesSession(assignmentId: string, attempt = 0): SlidesSession {
  const [session, setSession] = useState<SlidesSession>({ phase: "loading" });
  const documentIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSession({ phase: "loading" });
    if (noBrowserStorage()) { setSession({ phase: "unavailable" }); return; }
    let disposed = false;
    const abort = new AbortController();
    let saver: SlidesSaver | null = null;
    let unsubscribe = () => {};
    let channel: BroadcastChannel | null = null;
    let mark: SessionMark | null = null;

    /** Runs the session while the lock is held; returns when the page is left. */
    const runSession = async (scope: string, documentId: string) => {
      const journal = new AtomicDexieJournal(scope);
      const deps = browserSlidesDeps({
        journal, documentId, assignmentId, current: () => !disposed && !(mark && hasEnded(browserMarkStore(), mark)),
      });
      const mine = new SlidesSaver(deps);
      saver = mine;
      const result = await mine.load();
      if (disposed) { mine.close(); journal.close(); return; }
      if (result.kind === "unavailable") setSession({ phase: "unavailable" });
      else if (result.kind === "recovery") {
        setSession({ phase: "recovery", document: result.document, state: mine.snapshot().state, adopt: (confirmed) => mine.adoptServer(confirmed) });
      } else {
        setSession({
          phase: "ready", document: result.document, readOnly: result.readOnly, snapshot: mine.snapshot(),
          onSteps: (steps, after) => mine.record(steps, after),
        });
        unsubscribe = mine.subscribe((snapshot) => {
          setSession((now) => now.phase === "ready" ? { ...now, snapshot, readOnly: snapshot.closedBy !== null } : now);
        });
      }
      // Held for the life of the page.
      if (!abort.signal.aborted) await new Promise<void>((resolve) => abort.signal.addEventListener("abort", () => resolve(), { once: true }));
      unsubscribe();
      await mine.flush().catch(() => {});
      mine.pause();
      await mine.settled().catch(() => {});
      mine.close();
      journal.close();
    };

    void (async () => {
      const read = await readJournalScope().catch(() => ({ kind: "unavailable" as const }));
      if (disposed) return;
      if (read.kind === "signedOut") return setSession({ phase: "signed-out" });
      if (read.kind !== "scope") return setSession({ phase: "unavailable" });
      mark = read.session;
      if (hasEnded(browserMarkStore(), read.session)) return setSession({ phase: "signed-out" });
      const outcome = await openWork(assignmentId, guardedFetch(browserTransport, () => !disposed)).catch(() => null);
      if (disposed) return;
      // The lock is per work and named as the text editor's is. Offline, the work's id is the one an earlier
      // open of this page left; without either the work cannot be told apart and the page says so.
      const documentId = outcome?.status === "opened" ? outcome.work.documentId : documentIdRef.current;
      if (documentId === null || documentId === undefined) return setSession({ phase: "unavailable" });
      documentIdRef.current = documentId;
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(SESSION_END_CHANNEL);
        channel.onmessage = () => {
          if (mark && hasEnded(browserMarkStore(), mark)) { setSession({ phase: "signed-out" }); abort.abort(); }
        };
      }
      const name = `ductus-journal:${read.scope}:${documentId}`;
      const guarded = (id: string) => runSession(read.scope, id).catch(() => { if (!disposed) setSession({ phase: "unavailable" }); });
      await navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
        if (lock !== null) return guarded(documentId);
        if (disposed) return;
        setSession({ phase: "blocked" });
        // Wait for the other tab; leaving the page ends the wait.
        await navigator.locks.request(name, { signal: abort.signal }, () => guarded(documentId)).catch(() => {});
      });
    })();

    return () => {
      disposed = true;
      abort.abort();
      channel?.close();
      unsubscribe();
      void saver;
    };
  }, [assignmentId, attempt]);

  return useMemo(() => session, [session]);
}
