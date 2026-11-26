// WEB-V14-SHEET-JOURNAL (val 14): the saver of a spreadsheet work. It sits between
// the grid and the journal: the grid hands it every change as steps of
// `ductus-sheet-steps-v1` plus the document after the change; the saver records them
// (`SheetRecorder`), turns closed events into segments and saves each one in the
// journal in one transaction with its snapshot (`saveSegment`). Nothing is SYNCED
// here: the drain sends the queued rows and only a signed receipt moves the state.
//
// Rules, as for the evidence recorder of text:
//   - one write at a time (the saver serialises `edit` and `flush`);
//   - a change the recorder cannot record stops evidence for good: the author's
//     document is still saved (`saveUncovered`), no row is queued, the document is
//     never SYNCED again and the state says so (`failure`);
//   - what the journal refuses (another tab moved it, logout under way) halts the
//     saver: nothing more is written over it, and the failure stays visible.
import { SheetRecorder, SheetCaptureError, type SheetCaptureFailure } from "../serverSync/sheet-sync";
import type { EvidenceSource } from "../document/forensics/evidence-segment-v2";
import type { VerifiedWorkOpening } from "../serverSync/work-opening";
import type { SheetDocument } from "../sheet/model";
import type { SheetStep } from "../sheet/steps";
import type { EvidenceHead, EvidenceStop } from "../sync/journal-types";
import type { SyncState } from "../sync/states";
import type { AtomicDexieJournal } from "./atomic-dexie-journal";

export type SheetSaverFailure =
  | { kind: "evidence_stopped"; reason: EvidenceStop }
  | { kind: "journal"; code: string };

export type SheetLoad =
  | { kind: "ready"; document: SheetDocument }
  /** The journal could not be read or does not hold this spreadsheet work: nothing is shown as saved. */
  | { kind: "unavailable" };

export type SheetSaverSnapshot = {
  readonly state: SyncState;
  readonly failure: SheetSaverFailure | null;
  /** Closed events not yet in the journal. */
  readonly pendingEvents: number;
};

export type SheetSaverDeps = {
  readonly now?: () => Date;
  readonly newId?: () => string;
};

const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "unknown";
};

export class SheetSaver {
  private recorder: SheetRecorder | null = null;
  private localSeq = 0;
  private head: EvidenceHead = { segmentHash: null, lastSequenceTo: 0 };
  private profileId: string | null = null;
  private state: SyncState = "EDITING";
  private failure: SheetSaverFailure | null = null;
  private halted = false;
  private latest: SheetDocument | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<(snapshot: SheetSaverSnapshot) => void>();
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly sessionId: string;

  constructor(
    private readonly journal: AtomicDexieJournal,
    private readonly documentId: string,
    private readonly work: VerifiedWorkOpening,
    deps: SheetSaverDeps = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => globalThis.crypto.randomUUID());
    this.sessionId = this.newId();
  }

  snapshot(): SheetSaverSnapshot {
    return { state: this.state, failure: this.failure, pendingEvents: this.recorder?.pendingEvents ?? 0 };
  }

  subscribe(listener: (snapshot: SheetSaverSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of [...this.listeners]) listener(snapshot);
  }

  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /**
   * Reads the journal: the document a reopened work starts from is the journal's
   * snapshot (the author's newest), and the chain continues after its last queued
   * segment. Anything unreadable is `unavailable`, never an empty sheet.
   */
  load(): Promise<SheetLoad> {
    return this.serial(async () => {
      try {
        const contents = await this.journal.readEvidence(this.documentId, this.work);
        const snapshot = contents.snapshot;
        const meta = contents.meta;
        if (!snapshot || !meta?.evidenceHead) return { kind: "unavailable" as const };
        const document = snapshot.document as unknown as SheetDocument;
        if (document?.kind !== "spreadsheet") return { kind: "unavailable" as const };
        const last = contents.pending.at(-1)?.tx;
        this.head = last ? { segmentHash: last.segmentHash, lastSequenceTo: last.sequenceTo } : { ...meta.evidenceHead };
        this.localSeq = meta.localSeq;
        this.profileId = meta.evidenceProfileId ?? null;
        this.state = meta.state;
        this.latest = document;
        this.recorder = new SheetRecorder(document);
        if (meta.evidenceStopped !== undefined) {
          this.failure = { kind: "evidence_stopped", reason: meta.evidenceStopped };
        }
        this.emit();
        return { kind: "ready" as const, document };
      } catch (error) {
        this.halt(error);
        return { kind: "unavailable" as const };
      }
    });
  }

  /**
   * One change of the grid: its steps, its source and the document after it. The
   * segment is written once the event closes (`flush`), so a burst of typing is one
   * event, as for text.
   */
  edit(change: { steps: readonly SheetStep[]; source?: EvidenceSource; at?: number; document: SheetDocument }): Promise<void> {
    return this.serial(async () => {
      const recorder = this.recorder;
      if (recorder === null || this.halted) return;
      this.latest = change.document;
      if (this.failure !== null) return this.keepUncovered();
      try {
        await recorder.record({ steps: change.steps, source: change.source ?? "unattributed", at: change.at ?? this.now().getTime() });
        this.state = "EDITING";
      } catch (error) {
        if (!(error instanceof SheetCaptureError)) throw error;
        await this.stopEvidence(error.code);
        return;
      }
      this.emit();
    });
  }

  /** Closes the open event and writes every closed one as a segment. */
  flush(): Promise<void> {
    return this.serial(async () => {
      const recorder = this.recorder;
      if (recorder === null || this.halted) return;
      recorder.close();
      // Once evidence stopped, the journal takes no more segments: only the document is kept.
      if (this.failure !== null) return this.keepUncovered();
      const stopped = await this.drain(recorder);
      if (this.halted) return;
      if (stopped !== null) await this.stopEvidence(stopped);
      else this.emit();
    });
  }

  /**
   * Writes the closed events as segments. Returns why the recorder stopped (the
   * closed events before the failure were written first), or null when it did not.
   */
  private async drain(recorder: SheetRecorder): Promise<SheetCaptureFailure | null> {
    if (this.profileId === null) return null;
    for (;;) {
      let built;
      try {
        built = await recorder.takeSegment({
          documentId: this.documentId, sessionId: this.sessionId, segmentId: this.newId(),
          evidenceProfileId: this.profileId, sequenceFrom: this.head.lastSequenceTo + 1,
          predecessorSegmentHash: this.head.segmentHash,
        });
      } catch (error) {
        if (error instanceof SheetCaptureError) return error.code;
        throw error;
      }
      if (built === null) return null;
      try {
        const saved = await this.journal.saveSegment(this.documentId, built, this.now().toISOString(), this.localSeq, this.work);
        this.localSeq = saved.localSeq;
        this.state = saved.meta.state;
        this.head = { segmentHash: built.sha256, lastSequenceTo: built.segment.sequenceTo };
      } catch (error) {
        this.halt(error);
        return null;
      }
    }
  }

  /**
   * The recorder stopped: the events closed before it are written first (the journal
   * refuses segments once the stop is stored), then the author's document is saved
   * without evidence, for good.
   */
  private async stopEvidence(reason: SheetCaptureFailure): Promise<void> {
    const recorder = this.recorder;
    if (recorder !== null) {
      recorder.close();
      await this.drain(recorder);
      if (this.halted) return;
    }
    this.failure = { kind: "evidence_stopped", reason };
    await this.keepUncovered();
  }

  private async keepUncovered(): Promise<void> {
    if (this.failure?.kind !== "evidence_stopped" || this.latest === null) return this.emit();
    try {
      const meta = await this.journal.saveUncovered(
        this.documentId, this.latest as never, this.failure.reason, this.now().toISOString(), this.localSeq, this.work,
      );
      this.localSeq = meta.localSeq;
      this.state = meta.state;
    } catch (error) {
      this.halt(error);
      return;
    }
    this.emit();
  }

  private halt(error: unknown): void {
    this.halted = true;
    this.failure = { kind: "journal", code: codeOf(error) };
    this.emit();
  }
}
