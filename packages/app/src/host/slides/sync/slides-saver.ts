// WEB-V13-DNEVNIK-SINKRONIZACIJA (val 13): the saving of a slides work, the
// twin of EvidenceSession (src/components/editor/evidence-session.ts) for the
// slides step format. React-free; the adapters come in through `SlidesSaverDeps`.
//
// - `load` opens the work (`evidence.open`), verifies the answer as a slides
//   work, starts the journal and returns the journal's document. Without a
//   network it opens from the stored verified opening ("Spremljeno na uređaju").
// - Every change the editor applies is `record`ed as steps; after a quiet time
//   the closed events become segments, each is replayed over the journal's
//   snapshot and saved (`saveSegment`). A stop of the recorder or a failed
//   replay saves the document without evidence (`saveUncovered`) and nothing is
//   chained after it.
// - The head of the chain and the sequence come from the journal, never from
//   this object. The drain runs only while the browser reports a network and
//   one step at a time. SYNCED is shown only from the journal's state after a
//   receipt verified in this page session.
import type { OpenedWork, OpenOutcome } from "../../../../../../src/client/evidence-ingest.ts";
import { replayEvidenceSegmentsV2 } from "../../../../../editor-core/src/document/forensics/evidence-replay-v2.ts";
import type { JcsJsonValue } from "../../../../../editor-core/src/document/forensics/jcs.ts";
import {
  createSlidesReplayer, SlideCaptureError, SlidesRecorder, type BuiltSlidesSegment,
} from "../../../../../editor-core/src/document/forensics/slides-evidence.ts";
import type { AtomicDexieJournal } from "../../../../../editor-core/src/journal/atomic-dexie-journal.ts";
import { failureOf, type SaverFailure } from "../../../../../editor-core/src/journal/local-document-saver.ts";
import { verifyWorkOpening, type VerifiedWorkOpening } from "../../../../../editor-core/src/serverSync/work-opening.ts";
import { slidesSnapshotText } from "../../../../../editor-core/src/slides/json.ts";
import { MAX_SLIDES_SNAPSHOT_BYTES, type SlidesDocument } from "../../../../../editor-core/src/slides/model.ts";
import type { SlideStep } from "../../../../../editor-core/src/slides/steps.ts";
import { validateSlidesDocument } from "../../../../../editor-core/src/slides/validate.ts";
import type { EvidenceSegmentTransaction, EvidenceStop, JournalContents, SyncMeta } from "../../../../../editor-core/src/sync/journal-types.ts";
import type { VersionedDocument } from "../../../../../editor-core/src/document/document/index.ts";
import { restoreSyncState } from "../../../../../editor-core/src/sync/restore.ts";
import type { DrainRunner } from "../../../../../editor-core/src/sync/runner/drain-runner.ts";
import type { SyncState } from "../../../../../editor-core/src/sync/states.ts";
import { shownSaveState, STICKY_STATES, type SlidesLoadResult } from "./recovery.ts";

export type SlidesJournal = Pick<AtomicDexieJournal, "readEvidence" | "startEvidence" | "saveSegment" | "saveUncovered" | "readVerifiedWork">
  & Partial<Pick<AtomicDexieJournal, "adoptServerEvidence">>;

export type NetworkSignal = { online(): boolean; onOnline(listener: () => void): () => void };

export type SlidesSaverDeps = {
  journal: SlidesJournal;
  documentId: string;
  open: () => Promise<OpenOutcome>;
  createRunner: (work: OpenedWork, verified: VerifiedWorkOpening) => DrainRunner;
  network: NetworkSignal;
  /** Calls back when the commit route answers 409 `not_accepting` and the server confirms a submission. */
  watchSubmission?: (onClosed: () => void) => () => void;
  now?: () => Date;
  clock?: () => number;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Quiet time before the recorded changes are saved; the editor's own debounce. */
  saveDebounceMs?: number;
};

export type SlidesSnapshot = {
  readonly state: SyncState;
  readonly failure: SaverFailure | null;
  /** A receipt passed the signature check in this page session and the shown state is SYNCED. */
  readonly receiptVerified: boolean;
  /** "submission" once a submission closed the package: the editor turns read-only. */
  readonly closedBy: "submission" | null;
  /** The recorder stopped: what is written from here on stays on this device. */
  readonly stopped: boolean;
  /** The server refused the last row and only a reload sends it again. */
  readonly refused: boolean;
};

export type AdoptResult =
  | { kind: "adopted"; meta: SyncMeta }
  | { kind: "unavailable" }
  | { kind: "refused"; code: string };

type Contents = JournalContents<EvidenceSegmentTransaction, VersionedDocument>;
const HALTING: ReadonlySet<SaverFailure> = new Set(["corrupt", "stale", "unavailable"]);
const decoder = new TextDecoder();
export const SLIDES_SAVE_DEBOUNCE_MS = 800;

export class SlidesSaver {
  private loaded = false;
  private halted = false;
  private closed = false;
  private paused = false;
  private failure: SaverFailure | null = null;
  private stored: SyncState | null = null;
  private syncedHere = false;
  private owed = 0;
  private syncing = false;
  private saving = false;
  private seq = 0;
  private gen = 0;
  private cleanGen = 0;
  private stopped: EvidenceStop | null = null;
  private closedBy: "submission" | null = null;
  private refused = false;
  private manualOnly = false;
  private profile: string | null = null;
  private work: OpenedWork | null = null;
  private verified: VerifiedWorkOpening | null = null;
  private runner: DrainRunner | null = null;
  private recorder: SlidesRecorder | null = null;
  private sessionId = "";
  /** The editor's newest document: what `saveUncovered` writes once the recorder stopped. */
  private latest: SlidesDocument | null = null;
  private recording: Promise<void> = Promise.resolve();
  private unsaved: BuiltSlidesSegment | null = null;
  private flight: Promise<void> | null = null;
  private stepping: Promise<void> | null = null;
  private stepAgain = false;
  private opening: Promise<void> | null = null;
  private adopting = false;
  private saveTimer: unknown = null;
  private driveTimer: unknown = null;
  private unlisten: () => void = () => {};
  private unwatch: () => void = () => {};
  private readonly listeners = new Set<(snapshot: SlidesSnapshot) => void>();
  private readonly id: string;
  private readonly now: () => Date;
  private readonly clock: () => number;
  private readonly newId: () => string;

  constructor(private readonly deps: SlidesSaverDeps) {
    this.id = deps.documentId;
    this.now = deps.now ?? (() => new Date());
    this.clock = deps.clock ?? Date.now;
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  snapshot(): SlidesSnapshot {
    const closed = this.closedBy !== null;
    const state = this.state();
    return {
      state, failure: closed ? null : this.failure, receiptVerified: this.syncedHere && state === "SYNCED",
      closedBy: this.closedBy, stopped: !closed && this.stopped !== null,
      refused: !closed && this.owed > 0 && (this.refused || this.manualOnly),
    };
  }

  /** The editor's newest document as the saver holds it (shown read-only in recovery). */
  currentDocument(): SlidesDocument | null {
    return this.latest;
  }

  subscribe(listener: (snapshot: SlidesSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private state(): SyncState {
    return shownSaveState({
      stored: this.stored, failed: this.failure !== null,
      unsaved: this.gen !== this.cleanGen || this.saveTimer !== null || this.unsaved !== null,
      saving: this.saving, syncing: this.syncing, receiptVerifiedHere: this.syncedHere,
      closedBySubmission: this.closedBy !== null,
    });
  }

  /** Reads the journal and opens the work (once). Writes only `startEvidence`, and only when nothing is owed. */
  async load(): Promise<SlidesLoadResult<SlidesDocument>> {
    if (this.loaded || this.halted) throw new Error("SlidesSaver.load() runs once");
    const { journal } = this.deps;
    let contents: Contents;
    let opened: OpenOutcome;
    try {
      opened = await this.openSafely();
      if (this.closed) return { kind: "unavailable" };
      // The server's answer, when there is one, decides; only no answer at all
      // opens the work from its stored verified opening.
      this.verified = opened.status === "opened"
        ? await verifiedSlides(this.id, opened.work)
        : opened.status === "unavailable" ? await this.storedSlides() : null;
      if (this.closed) return { kind: "unavailable" };
      if (!this.verified) return this.haltLoad("unavailable");
      contents = await this.readJournal();
    } catch (error) {
      return this.haltLoad(failureOf(error));
    }
    if (opened.status === "opened") {
      this.work = opened.work;
      const meta = contents.meta;
      if (contents.pending.length === 0 && meta?.evidenceStopped === undefined && !(meta && STICKY_STATES.has(meta.state))) {
        try {
          await journal.startEvidence(this.id, { ...opened.work, documentKind: "slides" } as never, this.now().toISOString(), this.verified);
          contents = await this.readJournal();
        } catch (error) {
          // A journal ahead of a late answer keeps its own chain.
          if (!contents.meta?.evidenceHead) return this.haltLoad(failureOf(error));
        }
      }
    }
    if (this.closed) return { kind: "unavailable" };
    const { meta, snapshot } = contents;
    if (!meta?.evidenceHead || !snapshot) return this.haltLoad("unavailable");
    const document = validateSlidesDocument(snapshot.document);
    if (!document.ok) return this.haltLoad("corrupt", { kind: "recovery", reason: "corrupt", document: null });
    const restored = restoreSyncState(contents as unknown as JournalContents);
    this.seq = meta.localSeq;
    this.latest = document.doc;
    if (STICKY_STATES.has(restored)) {
      this.halted = true;
      this.stored = restored;
      this.emit();
      return { kind: "recovery", reason: "sticky", document: document.doc };
    }
    this.stored = restored;
    this.owed = contents.pending.length;
    this.refused = meta.refusedLocalSeq !== undefined;
    this.stopped = meta.evidenceStopped ?? null;
    this.profile = this.work?.evidenceProfileId ?? meta.evidenceProfileId ?? null;
    this.loaded = true;
    if (this.work?.submitted) {
      this.closedBy = "submission";
      this.emit();
      return { kind: "ready", document: document.doc, readOnly: true };
    }
    if (this.work) this.runner = this.deps.createRunner(this.work, this.verified);
    this.recorder = new SlidesRecorder(document.doc);
    this.sessionId = this.newId();
    this.unwatch = this.deps.watchSubmission?.(() => this.closeBySubmission()) ?? (() => {});
    this.unlisten = this.deps.network.onOnline(() => { this.retryOpen(); this.kick(); });
    this.emit();
    this.kick();
    return { kind: "ready", document: document.doc, readOnly: false };
  }

  /**
   * One change of the editor: the steps it is made of and the document after
   * them. Recorded in order; the save follows after a quiet time.
   */
  record(steps: readonly SlideStep[], after: SlidesDocument, source: "unattributed" | "editor" = "unattributed", at = Date.now()): void {
    if (!this.loaded || this.halted || this.closedBy || steps.length === 0) return;
    this.gen += 1;
    this.latest = after;
    const recorder = this.recorder;
    if (recorder && !this.stopped) {
      this.recording = this.recording.then(() => recorder.record({ steps, source, at })).catch((error) => {
        if (!(error instanceof SlideCaptureError)) throw error;
        // The student learns of the stop now, not at the next save.
        this.stopped = error.code;
        this.emit();
      });
    }
    this.scheduleSave();
    this.emit();
  }

  private scheduleSave(): void {
    this.clearSaveTimer();
    const set = this.deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.saveTimer = set(() => { this.saveTimer = null; void this.flush(); }, this.deps.saveDebounceMs ?? SLIDES_SAVE_DEBOUNCE_MS);
  }

  /** Saves what was recorded now (sign-out, page hide); resolves once the journal holds it. */
  async flush(): Promise<void> {
    this.clearSaveTimer();
    if (!this.loaded || this.halted || this.closedBy || this.adopting) return;
    // A recoverable failure (e.g. a full quota) does not end the session: a new flush tries again.
    this.failure = null;
    if (this.flight) {
      await this.flight;
      if (this.gen === this.cleanGen) return;
    }
    if (!this.stopped && this.profile === null) return; // wait for a successful open
    let settle!: (written: Promise<void>) => void;
    this.flight = new Promise<void>((resolve) => { settle = resolve; });
    settle(this.writeQueued());
    await this.flight;
  }

  private async writeQueued(): Promise<void> {
    try {
      while (this.gen !== this.cleanGen && this.failure === null && !this.halted && !this.closedBy && !this.adopting && (this.stopped || this.profile !== null)) {
        const before = this.cleanGen;
        const gen = this.gen;
        await this.save(gen);
        if (this.cleanGen === before && gen === this.gen) break;
      }
    } finally {
      this.flight = null;
      this.emit();
    }
  }

  private async save(gen: number): Promise<void> {
    this.saving = true;
    this.emit();
    try {
      await this.recording;
      const covers = this.stopped ? await this.saveUncovered(this.stopped) : await this.saveCovered(gen);
      // A change made while this save ran keeps the gen dirty: the loop saves again.
      if (covers) this.cleanGen = gen;
      this.failure = null;
    } catch (error) {
      // The change stays owed (gen is not clean); the next edit saves it again.
      this.failure = failureOf(error);
      if (HALTING.has(this.failure)) this.halted = true;
      await this.refresh();
    } finally {
      this.saving = false;
      this.emit();
    }
  }

  /** True when the journal now holds the recorder's document. */
  private async saveCovered(gen: number): Promise<boolean> {
    const { journal } = this.deps;
    const recorder = this.recorder!;
    recorder.close();
    for (;;) {
      if (this.ended) return false;
      const contents = await this.readJournal();
      const { meta, snapshot } = contents;
      if (!meta?.evidenceHead || !snapshot || meta.localSeq !== this.seq) {
        throw Object.assign(new Error("journal moved"), { code: "stale_local_sequence" });
      }
      if (this.stopped) {
        this.unsaved = null;
        return this.saveUncovered(this.stopped);
      }
      const tail = contents.pending.at(-1)?.tx;
      const head = tail ? { segmentHash: tail.segmentHash, lastSequenceTo: tail.sequenceTo } : meta.evidenceHead;
      let built = this.unsaved;
      if (built !== null && (built.segment.sequenceFrom !== head.lastSequenceTo + 1
        || built.segment.predecessorSegmentHash !== head.segmentHash)) {
        throw Object.assign(new Error("journal moved"), { code: "stale_local_sequence" });
      }
      if (built === null) {
        try {
          built = await recorder.takeSegment({
            documentId: this.id, sessionId: this.sessionId, segmentId: this.newId(),
            evidenceProfileId: this.profile!, sequenceFrom: head.lastSequenceTo + 1,
            predecessorSegmentHash: head.segmentHash,
          });
        } catch (error) {
          if (!(error instanceof SlideCaptureError)) throw error;
          return this.saveUncovered(error.code);
        }
      }
      if (built === null) break;
      // What is saved is what the server will replay: from the journal's snapshot to the segment's final hash.
      const replay = await replayEvidenceSegmentsV2(
        snapshot.document as unknown as JcsJsonValue, [built.segment], createSlidesReplayer());
      if (!replay.ok || replay.documentSha256 !== built.segment.finalDocumentHash) {
        this.unsaved = null;
        return this.saveUncovered("unsupported_step");
      }
      if (this.ended) return false;
      if (built.document.byteLength > MAX_SLIDES_SNAPSHOT_BYTES) {
        this.unsaved = null;
        return this.saveUncovered("too_large");
      }
      this.unsaved = built;
      const result = await journal.saveSegment(this.id, built, this.now().toISOString(), this.seq, this.verified!);
      this.unsaved = null;
      this.seq = result.localSeq;
      this.stored = result.meta.state;
      this.syncedHere = false;
      this.owed += 1;
      this.retryOpen();
      this.kick();
    }
    // Something was recorded meanwhile: the next round covers it.
    if (gen !== this.gen) return false;
    // The journal must hold the exact bytes of the editor's document, else a
    // change escaped the recorder and the chain cannot cover it.
    const expected = this.latest;
    const journalText = decoder.decode(slidesBytesOf((await this.readJournal()).snapshot?.document));
    // An edit made while the journal was read belongs to the next save, not to a gap.
    if (gen !== this.gen) return false;
    if (expected && journalText !== slidesSnapshotText(expected)) return this.saveUncovered("gap");
    return true;
  }

  private async saveUncovered(reason: EvidenceStop): Promise<boolean> {
    if (this.ended || !this.latest) return false;
    this.stopped = reason;
    const meta = await this.deps.journal.saveUncovered(
      this.id, this.latest as unknown as VersionedDocument, reason, this.now().toISOString(), this.seq, this.verified!);
    this.seq = meta.localSeq;
    this.stored = meta.state;
    this.syncedHere = false;
    return true;
  }

  /** Stops starting drain steps (sign-out dialog); saves still run. */
  pause(): void {
    this.paused = true;
    this.clearDriveTimer();
  }

  resume(): void {
    this.paused = false;
    this.kick();
  }

  /** No save, open or drain step in flight. */
  async settled(): Promise<void> {
    while (this.flight || this.stepping || this.opening) await (this.flight ?? this.stepping ?? this.opening);
  }

  /** The session ended: no timer, listener, recording, save or step from here. */
  close(): void {
    this.closed = true;
    this.halted = true;
    this.clearSaveTimer();
    this.clearDriveTimer();
    this.unlisten();
    this.unwatch();
  }

  private get ended(): boolean {
    return this.closed || this.closedBy !== null;
  }

  private closeBySubmission(): void {
    if (this.closedBy || this.closed) return;
    this.closedBy = "submission";
    this.clearSaveTimer();
    this.emit();
  }

  private kick(): void {
    if (this.stepping) {
      this.stepAgain = true;
      return;
    }
    if (!this.runner || this.halted || this.closedBy || this.paused || this.adopting || !this.deps.network.online()) return;
    this.clearDriveTimer();
    this.stepAgain = false;
    this.stepping = this.stepLoop().finally(() => {
      this.stepping = null;
      if (this.stepAgain) this.kick();
    });
  }

  private async stepLoop(): Promise<void> {
    while (this.runner && !this.halted && !this.closedBy && !this.paused && !this.adopting && this.deps.network.online()) {
      let result;
      this.syncing = this.owed > 0;
      if (this.syncing) this.emit();
      try {
        result = await this.runner.step(this.id);
      } catch {
        this.syncing = false;
        await this.refresh();
        return;
      }
      this.syncing = false;
      this.manualOnly = result.kind === "needs_retry";
      // SYNCED is claimed only for a step whose receipt the runner verified.
      if (result.kind === "sent" && result.state === "SYNCED") this.syncedHere = true;
      const contents = await this.refresh();
      if (result.kind === "sent" && contents && contents.pending.length > 0) continue;
      if (result.kind === "waiting" && !this.closed && !this.closedBy) {
        const set = this.deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
        this.driveTimer = set(() => { this.driveTimer = null; this.kick(); }, Math.max(0, result.notBefore - this.clock()));
      }
      return;
    }
  }

  private async refresh(): Promise<Contents | null> {
    try {
      const contents = await this.readJournal();
      if (contents.meta) {
        this.stored = contents.meta.state;
        this.refused = contents.meta.refusedLocalSeq !== undefined;
        this.owed = contents.pending.length;
        if (STICKY_STATES.has(contents.meta.state)) this.halted = true;
      }
      this.emit();
      return contents;
    } catch {
      return null;
    }
  }

  /** Opens again while the work is unknown: on `online` and after each saved segment. */
  private retryOpen(): void {
    if (this.work || this.opening || this.paused || this.ended || !this.deps.network.online()) return;
    this.opening = this.openSafely().then(async (opened) => {
      if (opened.status !== "opened" || this.closed) return;
      const fresh = await verifiedSlides(this.id, opened.work).catch(() => null);
      if (this.closed || this.work) return;
      if (!fresh) {
        this.failure = "unavailable";
        this.halted = true;
        return;
      }
      this.verified = fresh;
      this.work = opened.work;
      if (opened.work.submitted) return this.closeBySubmission();
      this.profile = opened.work.evidenceProfileId;
      this.runner = this.deps.createRunner(opened.work, fresh);
      if (this.gen !== this.cleanGen) void this.flush();
      this.kick();
    }).finally(() => {
      this.opening = null;
      this.emit();
    });
  }

  private async openSafely(): Promise<OpenOutcome> {
    try {
      return await this.deps.open();
    } catch {
      return { status: "unavailable" };
    }
  }

  private async storedSlides(): Promise<VerifiedWorkOpening | null> {
    try {
      const stored = await this.deps.journal.readVerifiedWork(this.id);
      return stored?.documentKind === "slides" ? stored : null;
    } catch {
      return null;
    }
  }

  private readJournal(): Promise<Contents> {
    return this.deps.journal.readEvidence(this.id, this.verified!);
  }

  /**
   * The way out of CONFLICT, RECOVERY_REQUIRED or a stopped record: take the
   * server's version and keep the local document as a copy (`adoptServerEvidence`).
   * `confirmed` is the author's word. The session closes; a new one loads the server's version.
   */
  async adoptServer(confirmed: boolean): Promise<AdoptResult> {
    const { journal } = this.deps;
    if (this.closed || this.adopting || !journal.adoptServerEvidence || !this.verified) return { kind: "unavailable" };
    this.adopting = true;
    this.clearDriveTimer();
    let result: AdoptResult = { kind: "unavailable" };
    try {
      await this.settled();
      const opened = await this.openSafely();
      if (this.closed || opened.status !== "opened") return result;
      const fresh = await verifiedSlides(this.id, opened.work).catch(() => null);
      if (!fresh) return result;
      try {
        const meta = await journal.adoptServerEvidence(
          this.id, { ...opened.work, documentKind: "slides" } as never, confirmed, this.now().toISOString(), this.seq, fresh);
        result = { kind: "adopted", meta };
        this.seq = meta.localSeq;
        this.stored = meta.state;
        this.syncedHere = false;
        this.close();
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        result = { kind: "refused", code: typeof code === "string" ? code : "unknown" };
      }
      return result;
    } finally {
      this.adopting = false;
      if (result.kind !== "adopted") this.kick();
      this.emit();
    }
  }

  private haltLoad(failure: SaverFailure, result: SlidesLoadResult<SlidesDocument> = { kind: "unavailable" }): SlidesLoadResult<SlidesDocument> {
    this.halted = true;
    this.failure = failure;
    this.emit();
    return result;
  }

  private clearSaveTimer(): void {
    if (this.saveTimer === null) return;
    (this.deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.saveTimer);
    this.saveTimer = null;
  }

  private clearDriveTimer(): void {
    if (this.driveTimer === null) return;
    (this.deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.driveTimer);
    this.driveTimer = null;
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        queueMicrotask(() => { throw error; });
      }
    }
  }
}

function slidesBytesOf(document: unknown): Uint8Array {
  const valid = validateSlidesDocument(document);
  return new TextEncoder().encode(valid.ok ? slidesSnapshotText(valid.doc) : "");
}

/** The open answer verified as a slides work, or null: a text work is never taken into a slides session. */
async function verifiedSlides(documentId: string, work: OpenedWork): Promise<VerifiedWorkOpening | null> {
  if (work.documentKind !== "slides") return null;
  const verified = await verifyWorkOpening(documentId, work);
  return verified?.documentKind === "slides" ? verified : null;
}
