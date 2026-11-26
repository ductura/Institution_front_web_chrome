"use client";

// WEB-V14-SHEET-PAGE: the work page of a spreadsheet work, mounted by host/student/work.tsx (one branch on the
// kind, see kind-port.ts). The document comes from the journal (SheetSaver over the verified opening), every change
// of the grid is turned into steps of ductus-sheet-steps-v1 and recorded, and the status bar claims only the state
// the session reached: SYNCED only after a drain step whose receipt the runner verified in this page session.
// A second tab, a missing sign-in, a sticky state and an unreadable kind each have their own card; none of them is
// shown as an empty sheet.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Card } from "@ductura/ui";

import { browserTransport } from "../../../../../../src/client/api.ts";
import { createCommitProtocol, openWork, type OpenedWork } from "../../../../../../src/client/evidence-ingest.ts";
import { guardedFetch, watchClosedBySubmission } from "../../../../../../src/client/evidence-session-deps.ts";
import { readOnline } from "../../../../../../src/client/online-status.ts";
import { browserMarkStore, hasEnded, SESSION_END_CHANNEL, type SessionMark } from "../../../../../../src/client/session-marks.ts";
import EditorPage from "../../../../../../src/components/editor/EditorPage.tsx";
import { readJournalScope } from "../../../../../../src/components/editor/EditorPage.scope.ts";
import StatusBar, { type StatusSave } from "../../../../../../src/components/editor/StatusBar.tsx";
import { AtomicDexieJournal } from "../../../../../editor-core/src/journal/atomic-dexie-journal.ts";
import { SheetSaver } from "../../../../../editor-core/src/journal/sheet-saver.ts";
import { verifyWorkOpening, type VerifiedWorkOpening } from "../../../../../editor-core/src/serverSync/work-opening.ts";
import {
  applySheetSteps, canonicalSheetDocument, parseCellRef, sheetCellSha256, sheetCellsSha256, sheetTextSha256,
  type Sheet, type SheetCell, type SheetDocument, type SheetStep,
} from "../../../../../editor-core/src/sheet/index.ts";
import type { QueuedTransaction } from "../../../../../editor-core/src/sync/journal-types.ts";
import { createDrainRunner, type DrainJournal, type DrainRunner } from "../../../../../editor-core/src/sync/runner/drain-runner.ts";
import { createEvidenceTransport, evidenceVerifierFor } from "../../../../../editor-core/src/sync/runner/evidence-transport.ts";
import type { SyncState } from "../../../../../editor-core/src/sync/states.ts";
import { SheetGrid } from "./SheetGrid";
import { sheetPageHr as t } from "./messages.hr";

// ---------------------------------------------------------------- document → steps

const cellsOfLine = (sheet: Sheet, axis: "row" | "column", at: number): Record<string, SheetCell> => {
  const out: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    const p = parseCellRef(ref)!;
    if ((axis === "row" ? p.row : p.column) === at) out[ref] = cell;
  }
  return out;
};

const sameCell = (a: SheetCell, b: SheetCell) => a.formula === b.formula && Object.is(a.value, b.value);

/** The cell steps that turn `from` into `to` (same size); null when a cell cannot be written as a step. */
async function cellSteps(sheetId: string, from: Sheet, to: Sheet): Promise<SheetStep[] | null> {
  const steps: SheetStep[] = [];
  const refs = [...new Set([...Object.keys(from.cells), ...Object.keys(to.cells)])].sort();
  for (const ref of refs) {
    const old = Object.hasOwn(from.cells, ref) ? from.cells[ref]! : undefined;
    const next = Object.hasOwn(to.cells, ref) ? to.cells[ref]! : undefined;
    if (old !== undefined && next !== undefined && sameCell(old, next)) continue;
    if (next === undefined) {
      steps.push({ type: "cellClear", sheetId, ref, removedSha256: await sheetCellSha256(old!) });
      continue;
    }
    const replacedSha256 = old === undefined ? undefined : await sheetCellSha256(old);
    const base = { type: "cellSet" as const, sheetId, ref, ...(replacedSha256 === undefined ? {} : { replacedSha256 }) };
    if (next.formula !== undefined) steps.push({ ...base, formula: next.formula });
    else if (next.value !== null) steps.push({ ...base, value: next.value });
    else return null;
  }
  return steps;
}

/**
 * The steps that turn `before` into `after`, or null when the change is not expressible in
 * ductus-sheet-steps-v1 (a sheet added or removed, a jump of more than one row or column). What is returned is
 * verified: applied to `before` it gives exactly `after`. Exported for the tests.
 */
export async function stepsBetween(before: SheetDocument, after: SheetDocument): Promise<SheetStep[] | null> {
  if (before.sheets.length !== after.sheets.length) return null;
  let working = before;
  const steps: SheetStep[] = [];
  for (let i = 0; i < before.sheets.length; i += 1) {
    const from = before.sheets[i]!;
    const to = after.sheets[i]!;
    if (from.id !== to.id) return null;
    const push = async (step: SheetStep): Promise<boolean> => {
      const applied = await applySheetSteps(working, [step]);
      if (!applied.ok) return false;
      working = applied.doc;
      steps.push(step);
      return true;
    };
    const current = () => working.sheets[i]!;
    if (from.name !== to.name && !(await push({ type: "sheetRename", sheetId: to.id, name: to.name, replacedSha256: await sheetTextSha256(from.name) }))) return null;
    const dRows = to.rows - from.rows;
    const dCols = to.columns - from.columns;
    if ((dRows !== 0 && dCols !== 0) || Math.abs(dRows) > 1 || Math.abs(dCols) > 1) return null;
    if (dRows !== 0 || dCols !== 0) {
      const axis = dRows !== 0 ? "row" : "column";
      const grow = (dRows || dCols) > 0;
      const limit = (axis === "row" ? from.rows : from.columns) + (grow ? 1 : 0);
      let best: { step: SheetStep; cost: number } | null = null;
      for (let at = 1; at <= limit; at += 1) {
        const step: SheetStep = grow
          ? (axis === "row" ? { type: "rowInsert", sheetId: to.id, row: at } : { type: "columnInsert", sheetId: to.id, column: at })
          : (axis === "row"
            ? { type: "rowRemove", sheetId: to.id, row: at, removedSha256: await sheetCellsSha256(cellsOfLine(current(), "row", at)) }
            : { type: "columnRemove", sheetId: to.id, column: at, removedSha256: await sheetCellsSha256(cellsOfLine(current(), "column", at)) });
        const applied = await applySheetSteps(working, [step]);
        if (!applied.ok) continue;
        const rest = await cellSteps(to.id, applied.doc.sheets[i]!, to);
        if (rest !== null && (best === null || rest.length < best.cost)) best = { step, cost: rest.length };
      }
      if (best === null || !(await push(best.step))) return null;
    }
    const rest = await cellSteps(to.id, current(), to);
    if (rest === null) return null;
    for (const step of rest) if (!(await push(step))) return null;
  }
  const check = await applySheetSteps(before, steps);
  if (!check.ok || canonicalSheetDocument(check.doc) !== canonicalSheetDocument(after)) return null;
  return steps;
}

// ---------------------------------------------------------------- session

const tabCommitProtocol = createCommitProtocol();
const STICKY: ReadonlySet<SyncState> = new Set(["CONFLICT", "RECOVERY_REQUIRED"]);
const SAVE_DEBOUNCE_MS = 800;

export type SheetSession =
  | { phase: "loading" }
  | { phase: "blocked" }
  | { phase: "unavailable" }
  | { phase: "signed-out" }
  | { phase: "recovery"; document: SheetDocument | null; state: SyncState }
  | { phase: "ready"; document: SheetDocument; readOnly: boolean; state: SyncState; stopped: boolean; journalHalted: boolean; refused: boolean;
      onChange: (next: SheetDocument) => Promise<boolean> };

const noBrowserStorage = () => typeof navigator === "undefined" || !navigator.locks || typeof indexedDB === "undefined" || !indexedDB;

async function verifiedSheet(documentId: string, work: OpenedWork): Promise<VerifiedWorkOpening | null> {
  // The client's open answer (src/client/evidence-ingest.ts) names only "slides": this page is mounted only for a work
  // whose assignment row says spreadsheet (kind-port.ts), so the opening is checked as one. A text or slides snapshot
  // does not verify as a sheet, so a work of another kind ends in "unavailable", never in an empty grid.
  if (work.documentKind === "slides") return null;
  const verified = await verifyWorkOpening(documentId, { ...work, documentKind: "spreadsheet" });
  return verified?.documentKind === "spreadsheet" ? verified : null;
}

/** The status the bar may claim: nothing while there is no state, the block for a second tab. */
export function sheetStatusOf(session: SheetSession): StatusSave | null {
  if (session.phase === "blocked") return { state: "LOCAL_DURABLE", receiptSigned: false, blocked: true };
  if (session.phase === "recovery") return { state: session.state === "CONFLICT" ? "CONFLICT" : "RECOVERY_REQUIRED", receiptSigned: false, blocked: false };
  if (session.phase !== "ready") return null;
  return { state: session.state, receiptSigned: session.state === "SYNCED", blocked: false };
}

export function useSheetSession(assignmentId: string, attempt = 0): SheetSession {
  const [session, setSession] = useState<SheetSession>({ phase: "loading" });
  const documentIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSession({ phase: "loading" });
    if (noBrowserStorage()) { setSession({ phase: "unavailable" }); return; }
    let disposed = false;
    const abort = new AbortController();
    let channel: BroadcastChannel | null = null;
    let mark: SessionMark | null = null;
    const current = () => !disposed && !(mark && hasEnded(browserMarkStore(), mark));

    const runSession = async (scope: string, documentId: string, opened: OpenedWork | null, verified: VerifiedWorkOpening) => {
      const journal = new AtomicDexieJournal(scope);
      const dispose = () => { journal.close(); };
      try {
        let contents = await journal.readEvidence(documentId, verified);
        const meta = contents.meta;
        if (opened !== null && contents.pending.length === 0 && meta?.evidenceStopped === undefined && !(meta && STICKY.has(meta.state))) {
          try {
            await journal.startEvidence(documentId, { ...opened, documentKind: "spreadsheet" } as never, new Date().toISOString(), verified);
          } catch (error) {
            // A journal ahead of a late answer keeps its own chain.
            if (!meta?.evidenceHead) throw error;
          }
          contents = await journal.readEvidence(documentId, verified);
        }
        if (contents.meta && STICKY.has(contents.meta.state)) {
          const doc = contents.snapshot?.document as unknown as SheetDocument | undefined;
          setSession({ phase: "recovery", document: doc?.kind === "spreadsheet" ? doc : null, state: contents.meta.state });
          return await hold(dispose);
        }
        const saver = new SheetSaver(journal, documentId, verified);
        const load = await saver.load();
        if (disposed) return dispose();
        if (load.kind !== "ready") { setSession({ phase: "unavailable" }); return await hold(dispose); }

        let latest = load.document;
        let closed = opened?.submitted === true;
        let syncedHere = false;
        let syncing = false;
        let refused = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let queue: Promise<unknown> = Promise.resolve();
        let runner: DrainRunner | null = null;
        const closedWatch = opened === null ? null : watchClosedBySubmission(guardedFetch(browserTransport, current), async () => {
          const again = await openWork(assignmentId, guardedFetch(browserTransport, current));
          return again.status === "opened" && again.work.submitted;
        });
        if (opened !== null && !closed) {
          const drainJournal = {
            beginSend: (id: string, sent: unknown) => journal.beginSend(id, sent as never),
            recordAnswer: (id: string, sent: unknown, outcome: unknown, state: unknown) => journal.recordAnswer(id, sent as never, outcome as never, state as never),
            read: (id: string) => journal.readEvidence(id, verified),
          } as unknown as DrainJournal;
          runner = createDrainRunner<QueuedTransaction>({
            journal: drainJournal,
            transport: createEvidenceTransport(closedWatch!.fetchImpl, tabCommitProtocol, verified),
            verifyFor: evidenceVerifierFor(opened),
          });
        }

        const publish = () => {
          if (disposed) return;
          const snap = saver.snapshot();
          const stored = snap.state;
          let state: SyncState = stored;
          if (STICKY.has(stored)) return setSession({ phase: "recovery", document: latest, state: stored });
          if (snap.failure?.kind === "journal") state = "ERROR";
          else if (snap.pendingEvents > 0 || timer !== null) state = "EDITING";
          else if (syncing) state = "SYNCING";
          else if (stored === "SYNCING") state = "LOCAL_DURABLE";
          else if (stored === "SYNCED" && !syncedHere) state = "LOCAL_DURABLE";
          setSession({
            phase: "ready", document: latest, readOnly: closed, state, onChange,
            stopped: snap.failure?.kind === "evidence_stopped", journalHalted: snap.failure?.kind === "journal", refused,
          });
        };

        const drive = async () => {
          if (runner === null || closed || disposed || !readOnline(globalThis.window)) return;
          if (syncing) return;
          syncing = true;
          publish();
          try {
            for (;;) {
              const result = await runner.step(documentId);
              refused = result.kind === "needs_retry";
              if (result.kind === "sent" && result.state === "SYNCED") syncedHere = true;
              if (result.kind === "sent") continue;
              if (result.kind === "waiting" && !disposed) {
                setTimeout(() => void drive(), Math.max(0, result.notBefore - Date.now()));
              }
              break;
            }
          } catch { /* the row stays owed; the next save or the network coming back sends it again */ }
          syncing = false;
          publish();
        };

        const flush = () => {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          return (queue = queue.then(() => saver.flush()).then(() => { publish(); return drive(); }).catch(() => { publish(); }));
        };

        async function onChange(next: SheetDocument): Promise<boolean> {
          if (closed || disposed) return false;
          const result = (queue = queue.then(async () => {
            const steps = await stepsBetween(latest, next);
            if (steps === null) return false;
            if (steps.length === 0) return true;
            latest = next;
            syncedHere = false;
            await saver.edit({ steps, document: next });
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => { timer = null; void flush(); }, SAVE_DEBOUNCE_MS);
            publish();
            return true;
          }).catch(() => false));
          return result as Promise<boolean>;
        }

        const leave = () => { void flush(); };
        const hide = () => { if (document.visibilityState === "hidden") leave(); };
        globalThis.addEventListener?.("pagehide", leave);
        document.addEventListener("visibilitychange", hide);
        const onlineAgain = () => void drive();
        globalThis.addEventListener?.("online", onlineAgain);
        const unwatch = closedWatch?.watch(() => { closed = true; publish(); }) ?? (() => {});
        publish();
        void drive();

        await hold(() => {});
        globalThis.removeEventListener?.("pagehide", leave);
        globalThis.removeEventListener?.("online", onlineAgain);
        document.removeEventListener("visibilitychange", hide);
        unwatch();
        await flush();
        dispose();
      } catch {
        if (!disposed) setSession({ phase: "unavailable" });
        dispose();
      }
    };

    /** Held for the life of the page. */
    const hold = async (after: () => void) => {
      if (!abort.signal.aborted) await new Promise<void>((resolve) => abort.signal.addEventListener("abort", () => resolve(), { once: true }));
      after();
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
      let opened: OpenedWork | null = null;
      let verified: VerifiedWorkOpening | null = null;
      let documentId = documentIdRef.current;
      if (outcome?.status === "opened") {
        opened = outcome.work;
        documentId = outcome.work.documentId;
        verified = await verifiedSheet(documentId, outcome.work).catch(() => null);
      } else if (documentId !== null) {
        // Offline: the stored verified opening of this work, only if it is a spreadsheet's.
        const probe = new AtomicDexieJournal(read.scope);
        const stored = await probe.readVerifiedWork(documentId).catch(() => null);
        probe.close();
        verified = stored?.documentKind === "spreadsheet" ? stored : null;
      }
      if (disposed) return;
      if (documentId === null || verified === null) return setSession({ phase: "unavailable" });
      documentIdRef.current = documentId;
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(SESSION_END_CHANNEL);
        channel.onmessage = () => {
          if (mark && hasEnded(browserMarkStore(), mark)) { setSession({ phase: "signed-out" }); abort.abort(); }
        };
      }
      const name = `ductus-journal:${read.scope}:${documentId}`;
      const id = documentId;
      const ok = verified;
      const guarded = () => runSession(read.scope, id, opened, ok);
      await navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
        if (lock !== null) return guarded();
        if (disposed) return;
        setSession({ phase: "blocked" });
        await navigator.locks.request(name, { signal: abort.signal }, () => guarded()).catch(() => {});
      });
    })();

    return () => { disposed = true; abort.abort(); channel?.close(); };
  }, [assignmentId, attempt]);

  return useMemo(() => session, [session]);
}

// ---------------------------------------------------------------- page

type Frame = {
  assignmentId: string;
  course: string | null;
  title: string | null;
  topBar: ReactNode;
  length: React.ComponentProps<typeof StatusBar>["length"];
  onRetry: () => void;
};

/** An unreadable kind opens no session: nothing is read or written for a work that is not known to be a spreadsheet. */
export function SheetPage({ unreadable, ...frame }: Frame & { unreadable: boolean }) {
  if (unreadable) {
    return (
      <EditorPage course={frame.course} title={frame.title} topBar={frame.topBar} status={<StatusBar save={null} readOnly={false} length={frame.length} />}>
        <Card title={t.kindUnavailableTitle}>
          <p role="alert">{t.kindUnavailableBody}</p>
          <Button tone="secondary" onClick={frame.onRetry}>{t.retry}</Button>
        </Card>
      </EditorPage>
    );
  }
  return <SessionPage {...frame} />;
}

function SessionPage({ assignmentId, course, title, topBar, length, onRetry }: Frame) {
  const [attempt, setAttempt] = useState(0);
  const session = useSheetSession(assignmentId, attempt);
  const retry = useCallback(() => { setAttempt((n) => n + 1); onRetry(); }, [onRetry]);
  const submitted = session.phase === "ready" && session.readOnly;
  return (
    <EditorPage course={course} title={title} topBar={topBar} status={<StatusBar save={sheetStatusOf(session)} readOnly={submitted} length={length} />}>
      <Body session={session} retry={retry} />
    </EditorPage>
  );
}

function Body({ session, retry }: { session: SheetSession; retry: () => void }) {
  const [refusal, setRefusal] = useState(false);
  switch (session.phase) {
    case "loading": return <SheetGrid state="loading" document={null} onChange={() => {}} />;
    case "blocked": return <Card title={t.blockedTitle}><p role="status">{t.blockedBody}</p></Card>;
    case "signed-out": return <Card title={t.signedOutTitle}><p role="status">{t.signedOutBody}</p></Card>;
    case "unavailable": return (
      <Card title={t.unavailableTitle}>
        <p role="alert">{t.unavailableBody}</p>
        <Button tone="secondary" onClick={retry}>{t.retry}</Button>
      </Card>
    );
    case "recovery": return (
      <Card title={t.recoveryTitle}>
        <p role="alert">{t.recoveryBody}</p>
        {session.document !== null && <SheetGrid state="ready" document={session.document} onChange={() => {}} readOnly />}
      </Card>
    );
    case "ready": return (
      <>
        {session.readOnly && <p role="status">{t.submittedNote}</p>}
        {session.stopped && <p role="alert">{t.stoppedNote}</p>}
        {session.refused && <p role="alert">{t.refusedNote}</p>}
        {session.journalHalted && <p role="alert">{t.journalNote}</p>}
        {refusal && <p role="alert">{t.notRecordable}</p>}
        <SheetGrid state="ready" document={session.document} readOnly={session.readOnly || session.journalHalted}
          onChange={(next) => { void session.onChange(next).then((ok) => setRefusal(!ok)); }} />
      </>
    );
  }
}
