/**
 * F-8 3d-2c2 (DAN-37, contract #476 c.6391714810): the saving of a document
 * with evidence in `/rad?zadatak=`, with the surface `LocalDocument` already
 * uses from `LocalDocumentSaver` (`load`, `edit`, `propose`, `settled`,
 * `snapshot`, `subscribe`) and `record`, `pause`, `resume`, `close`.
 *
 * - Every change the editor applies is recorded with its source; each local
 *   save turns the closed events into segments, replays each over the
 *   journal's snapshot (W2) and saves it (`saveSegment`). A stop of the
 *   recorder or a failed replay saves the text without evidence
 *   (`saveUncovered`), and nothing is recorded or chained after it (W3).
 * - The head of the chain and the sequence always come from the journal,
 *   never from this object (D4); the `localSeq` it expects is its own, so a
 *   write of another instance is `stale`.
 * - The drain runs only while the browser reports a network (G2,
 *   c.6393716541) and at most one step at a time. SYNCED is shown only from
 *   the journal's meta after a receipt verified in this page session (W1,
 *   G3): a reload starts at LOCAL_DURABLE.
 *
 * React-free; the adapters come in through `EvidenceSessionDeps`
 * (`src/client/evidence-session-deps.ts` in the browser).
 */

import type { Node as PmNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import type { OpenedWork, OpenOutcome } from "@/client/evidence-ingest";
import { validateDocument, validateVersionedDocument, type CanonicalDocument, type CanonicalDocumentV3, type VersionedDocument } from "@/domain/document";
import type { AsyncEvidenceStepReplayerV2 } from "@/domain/forensics/evidence-replay-v2";
import { replayEvidenceSegmentsV2 } from "@/domain/forensics/evidence-replay-v2";
import { canonicalizeJcs, type JcsJsonValue } from "@/domain/forensics/jcs";
import { MAX_DOCUMENT_SNAPSHOT_BYTES } from "@/domain/document/snapshot";
import type {
  EvidenceSegmentTransaction, EvidenceStop, JournalContents, SalvageCopy, SyncMeta,
} from "@/domain/sync/journal-types";
import { restoreSyncState } from "@/domain/sync/restore";
import type { SyncState } from "@/domain/sync/states";
import { CaptureError, EvidenceRecorder, type BuiltSegment, NO_OBSERVATION, recordWithSource, type SourceObservation } from "@/editor";
import { verifyWorkOpening, type VerifiedWorkOpening } from "@/domain/serverSync/work-opening";
import type { AtomicDexieJournal } from "@/lib/journal/atomic-dexie-journal";
import {
  failureOf, type LoadResult, type SaverFailure, type SaverSnapshot,
} from "@/lib/journal/local-document-saver";
import type { DrainRunner } from "@/lib/sync/drain-runner";

export type EvidenceJournal = Pick<AtomicDexieJournal, "readEvidence" | "startEvidence" | "saveSegment" | "saveUncovered">
  /** PIL-K-V3-OPORAVAK: the way out of a sticky state and its kept copies; without them `adoptServer` and `salvage` do nothing. */
  & Partial<Pick<AtomicDexieJournal, "adoptServerEvidence" | "readSalvage">>
  /** PIL-K-V3-BEZ-MREZE: the stored verified opening; without it a v3 work opens only with the server's answer. */
  & Partial<Pick<AtomicDexieJournal, "readVerifiedWork">>;

/**
 * What `adoptServer` did: the journal took the server's version (the session
 * is closed, a new one loads it), the server's answer could not be had or
 * verified for this work (nothing written), or the journal refused it with
 * its code (nothing written; `confirmation_required` asks the author first).
 */
export type AdoptResult =
  | { kind: "adopted"; meta: SyncMeta }
  | { kind: "unavailable" }
  | { kind: "refused"; code: string };

/** Whether the browser reports a network, and a call on each `online` event. */
export type NetworkSignal = { online(): boolean; onOnline(listener: () => void): () => void };

export type EvidenceSessionDeps = {
  journal: EvidenceJournal;
  documentId: string;
  /** `openWork(assignmentId)`; a throw counts as `unavailable`. */
  open: () => Promise<OpenOutcome>;
  replayer: () => AsyncEvidenceStepReplayerV2<PmNode>;
  /**
   * The drain runner over this journal, verifying receipts with `work`'s keys
   * only; `verified` is given for a v3 work only, whose rows the journal reads
   * and the transport checks against it.
   */
  createRunner: (work: OpenedWork, verified?: VerifiedWorkOpening) => DrainRunner;
  /**
   * PIL-K-SPREMANJE-V3: 3 when the page built the sheet with the v3 schema
   * for a work the server confirmed as v3. Absent is the v1 session, whose
   * document, journal and evidence stay byte for byte as before. A v3 session
   * opens only once the server's answer is verified as this v3 work.
   */
  schemaVersion?: 3;
  network: NetworkSignal;
  /**
   * Calls back when the commit route answers 409 `not_accepting`: a
   * submission closed the package (3d-2c2a §4, DAN-289 A1). Without it the
   * session never closes by submission.
   */
  watchSubmission?: (onClosed: () => void) => () => void;
  /**
   * The evidence profile the journal keeps for the document, for building
   * segments while the open route cannot be reached (O3 b, c.6392622568).
   * The browser adapter reads `meta.evidenceProfileId`, which `startEvidence`
   * stores; without one (an older record) segments wait for a successful
   * `open` (O3 a).
   */
  storedProfile?: (meta: SyncMeta | null) => string | null;
  now?: () => Date;
  /** The drain runner's clock, for its `notBefore`. */
  clock?: () => number;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/** The session's snapshot; `closedBy` tells the editor to turn read-only (3d-2c2b). */
export type EvidenceSnapshot = SaverSnapshot & {
  closedBy: "submission" | null;
  /**
   * INT-11: a receipt passed the Ed25519 check in this page session and the
   * shown state is SYNCED. The status bar reads this, never the state alone.
   */
  receiptVerified: boolean;
  /**
   * The server refused the last row and nothing sends it again by itself
   * (3d-2c2 §3): a refusal for good (`meta.refusedLocalSeq`), or a 426 or an
   * unreadable answer the drain holds for a manual retry. Only a reload sends
   * it again.
   */
  refused: boolean;
  /**
   * The work is submitted (DAN-215, K7c/K7d): closed by submission here, or
   * confirmed by the server's open answer whatever stopped the load, such as
   * a sticky CONFLICT or RECOVERY_REQUIRED that returns before `closedBy` is
   * set (review codex:cxcr1742, c.6726896384). It changes nothing else.
   */
  submitted: boolean;
  /**
   * DAN-699 (#1876): the recorder stopped, so what is written from here on
   * stays on this device and the server never takes it. Set from the stop
   * itself or from `meta.evidenceStopped` after a reload; never with a
   * closed package.
   */
  stopped: boolean;
  /**
   * The text on this device may hold changes the server has not confirmed
   * (DAN-314, review c.6779406784): a change inside the save debounce or on
   * its way to the journal, a row owed (offline, refused), a failure, a stop
   * of the evidence, a sticky state, or no load yet. An answer to a revision
   * request names the server's current revision, so it waits for `false`.
   */
  unconfirmed: boolean;
};

/** What the sheet proposes: a v1 document, or a v3 one for a v3 session. */
export type SheetDocument = CanonicalDocument | CanonicalDocumentV3;

type Candidate = { doc: SheetDocument; gen: number; marks: number };
type Contents = JournalContents<EvidenceSegmentTransaction, VersionedDocument>;

const STICKY: ReadonlySet<SyncState> = new Set(["CONFLICT", "RECOVERY_REQUIRED"]);
const HALTING: ReadonlySet<SaverFailure> = new Set(["corrupt", "stale", "unavailable"]);
const decoder = new TextDecoder();

export class EvidenceSession {
  private loaded = false;
  private halted = false;
  private closed = false;
  private paused = false;
  private failure: SaverFailure | null = null;
  /** The journal's meta state as last read or written; SYNCED is shown only with `syncedHere`. */
  private stored: SyncState | null = null;
  private syncedHere = false;
  /** Rows owed as last read or written; SYNCING is shown only while a step runs for them (P2). */
  private owed = 0;
  private syncing = false;
  private seq = 0;
  private gen = 0;
  private cleanGen = 0;
  private recorded = 0;
  private stopped: EvidenceStop | null = null;
  /** §4: a submission closed the package; nothing is written or sent from here. */
  private closedBy: "submission" | null = null;
  private refused = false;
  /** The drain's last step held the front row for a manual retry (426, unreadable answer). */
  private manualOnly = false;
  private profile: string | null = null;
  private work: OpenedWork | null = null;
  /** A v3 session's work as verified at load; the journal takes v3 only with it. */
  private verified: VerifiedWorkOpening | null = null;
  private runner: DrainRunner | null = null;
  private recorder: EvidenceRecorder | null = null;
  private sessionId = "";
  private next: Candidate | null = null;
  /**
   * A segment taken from the recorder whose journal write has not succeeded.
   * Its events are no longer in the recorder, so the next save writes this
   * segment first instead of losing them; a failed write leaves the journal
   * as it was, so the segment still fits its head.
   */
  private unsaved: BuiltSegment | null = null;
  private saving = false;
  /** `adoptServer` runs: no write or drain step starts until the journal answered. */
  private adopting = false;
  private flight: Promise<void> | null = null;
  private stepping: Promise<void> | null = null;
  private stepAgain = false;
  private opening: Promise<void> | null = null;
  private timer: unknown = null;
  private unlisten: () => void = () => {};
  private unwatch: () => void = () => {};
  private readonly listeners = new Set<(snapshot: EvidenceSnapshot) => void>();
  private readonly id: string;
  private readonly now: () => Date;
  private readonly clock: () => number;
  private readonly newId: () => string;

  constructor(private readonly deps: EvidenceSessionDeps) {
    this.id = deps.documentId;
    this.now = deps.now ?? (() => new Date());
    this.clock = deps.clock ?? Date.now;
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  snapshot(): EvidenceSnapshot {
    // §4: the refused row stays on the device; that is no failure of this device.
    const failure = this.closedBy ? null : this.failure;
    // Tied to the held row, not to ERROR: a later local save writes
    // LOCAL_DURABLE while the same row is still refused (review #811 c.6419592134).
    const refused = !this.closedBy && this.owed > 0 && (this.refused || this.manualOnly);
    const submitted = this.closedBy === "submission" || this.work?.submitted === true;
    const stopped = !this.closedBy && this.stopped !== null;
    const state = this.state();
    return { state, receiptVerified: this.syncedHere && state === "SYNCED", failure, capacity: "ok", closedBy: this.closedBy, refused, submitted, stopped, unconfirmed: this.unconfirmed() };
  }

  /** Read only; see `EvidenceSnapshot.unconfirmed`. */
  private unconfirmed(): boolean {
    return !this.loaded || this.halted || this.failure !== null || this.stopped !== null ||
      this.owed > 0 || this.syncing || this.saving || this.next !== null || this.unsaved !== null ||
      this.gen !== this.cleanGen || (this.stored !== null && STICKY.has(this.stored));
  }

  subscribe(listener: (snapshot: EvidenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * Reads the journal and opens the work at once (§2 Otvaranje). Writes only
   * `startEvidence`, and only for the provider's own document with nothing
   * owed, not stopped and not sticky; otherwise the journal's chain goes on.
   */
  async load(): Promise<LoadResult<SheetDocument>> {
    if (this.loaded || this.halted) throw new Error("EvidenceSession.load() runs once");
    const { journal } = this.deps;
    let contents: Contents;
    let opened: OpenOutcome;
    try {
      if (this.deps.schemaVersion === 3) {
        // The journal holds a v3 work only under its verified opening, so the
        // answer comes first; without it nothing is read or written.
        opened = await this.openSafely();
        if (this.closed) return { kind: "unavailable" };
        // PIL-K-V3-BEZ-MREZE: the server's answer, when there is one, decides;
        // only no answer at all opens the work from its stored verified opening.
        this.verified = opened.status === "opened"
          ? await verifiedV3(this.id, opened.work)
          : opened.status === "unavailable" ? await this.storedV3() : null;
        if (this.closed) return { kind: "unavailable" };
        if (!this.verified) return this.haltLoad("unavailable");
        contents = await this.readJournal();
      } else {
        [contents, opened] = await Promise.all([journal.readEvidence(this.id), this.openSafely()]);
      }
    } catch (error) {
      return this.haltLoad(failureOf(error));
    }
    // close() during the read or the open: nothing is written and nothing listens.
    if (this.closed) return { kind: "unavailable" };
    if (opened.status === "opened") {
      if (opened.work.documentId !== this.id) return this.haltLoad("unavailable");
      this.work = opened.work;
      const meta = contents.meta;
      if (contents.pending.length === 0 && meta?.evidenceStopped === undefined && !STICKY.has(meta?.state as SyncState)) {
        try {
          if (this.verified) await journal.startEvidence(this.id, opened.work, this.now().toISOString(), this.verified);
          else await journal.startEvidence(this.id, opened.work, this.now().toISOString());
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
    const document = this.verified ? validV3(snapshot.document) : validateDocument(snapshot.document);
    if (!document.ok) return this.haltLoad("corrupt", { kind: "recovery", reason: "corrupt", document: null });
    const restored = restoreSyncState(contents as unknown as JournalContents);
    // The sequence the way out of a sticky state expects (`adoptServer`).
    this.seq = meta.localSeq;
    if (STICKY.has(restored)) {
      this.halted = true;
      this.stored = restored;
      this.emit();
      return { kind: "recovery", reason: "sticky", document: document.doc };
    }
    this.stored = restored;
    this.owed = contents.pending.length;
    // A reload before the work opens still says the stored refusal.
    this.refused = meta.refusedLocalSeq !== undefined;
    this.stopped = meta.evidenceStopped ?? null;
    this.profile = this.work?.evidenceProfileId ?? this.deps.storedProfile?.(meta) ?? null;
    this.loaded = true;
    if (this.work?.submitted) {
      // O2 (DAN-289, #756 c.6399602745): a submitted work opens closed, the
      // same as after a 409 `not_accepting`. No recorder, runner, watch or
      // `online` listener starts, so nothing more goes to `/api/evidence/*`;
      // the rows the journal holds stay there, neither sent nor deleted.
      this.closedBy = "submission";
      this.emit();
      return { kind: "ready", document: document.doc };
    }
    if (this.work) this.runner = this.verified ? this.deps.createRunner(this.work, this.verified) : this.deps.createRunner(this.work);
    this.recorder = this.verified ? new EvidenceRecorder(undefined, 3) : new EvidenceRecorder();
    this.sessionId = this.newId();
    this.unwatch = this.deps.watchSubmission?.(() => this.closeBySubmission()) ?? (() => {});
    this.unlisten = this.deps.network.onOnline(() => {
      this.retryOpen();
      this.kick();
    });
    this.emit();
    this.kick();
    return { kind: "ready", document: document.doc };
  }

  /** One editor change (`transaction` event); the caller gates it on its ready flag. */
  record(transactions: readonly Transaction[], observation: SourceObservation = NO_OBSERVATION, at = Date.now()): void {
    if (!this.recorder || this.stopped || this.halted || this.closedBy) return;
    if (!transactions.some((tr) => tr.docChanged)) return;
    this.recorded += 1;
    try {
      recordWithSource(this.recorder, transactions, observation, at);
    } catch (error) {
      if (!(error instanceof CaptureError)) throw error;
      this.stopped = error.code;
      // DAN-699: the student learns of the stop now, not at the next save.
      this.emit();
    }
  }

  edit(): void {
    this.gen += 1;
    this.emit();
  }

  propose(doc: SheetDocument): Promise<void> {
    if (!this.loaded) {
      if (this.halted) return Promise.resolve();
      throw new Error("EvidenceSession.propose() before a ready load()");
    }
    if (this.closedBy) return Promise.resolve();
    this.next = { doc, gen: this.gen, marks: this.recorded };
    this.startWrites();
    return this.flight ?? Promise.resolve();
  }

  /** No save, open or drain step in flight; a paused drain starts none. */
  async settled(): Promise<void> {
    while (this.flight || this.stepping || this.opening) {
      await (this.flight ?? this.stepping ?? this.opening);
    }
  }

  /** Stops starting drain steps (sign-out dialog); saves still run. */
  pause(): void {
    this.paused = true;
    this.clearTimer();
  }

  resume(): void {
    this.paused = false;
    this.startWrites();
    this.kick();
  }

  /** The session ended: no timer, listener, recording, save or step from here. */
  close(): void {
    this.closed = true;
    this.halted = true;
    this.clearTimer();
    this.unlisten();
    this.unwatch();
  }

  /** Closed by `close()` or by a submission: nothing more is written. */
  private get ended(): boolean {
    return this.closed || this.closedBy !== null;
  }

  /** §4: terminal and not an error; the refused row stays in the journal untouched. */
  private closeBySubmission(): void {
    if (this.closedBy || this.closed) return;
    this.closedBy = "submission";
    this.next = null;
    this.clearTimer();
    this.emit();
  }

  private state(): SyncState {
    if (this.stored && STICKY.has(this.stored)) return this.stored;
    if (this.closedBy) return "LOCAL_DURABLE";
    if (this.failure) return "ERROR";
    if (this.gen !== this.cleanGen || this.next) return this.saving ? "SAVING_LOCAL" : "EDITING";
    if (this.stored === null) return "EDITING";
    // P2 (#476 c.6395903987): shown in memory only, never written to the journal.
    if (this.syncing) return "SYNCING";
    // G3: SYNCED only from a receipt verified in this page session; a SYNCING
    // left in meta outside a step of this session is a send that never ended.
    if (this.stored === "SYNCING") return "LOCAL_DURABLE";
    return this.stored === "SYNCED" && !this.syncedHere ? "LOCAL_DURABLE" : this.stored;
  }

  private startWrites(): void {
    if (this.flight || this.halted || this.closedBy || this.adopting || !this.next) return;
    if (!this.stopped && this.profile === null) return; // O3 a: wait for a successful open
    let settle!: (written: Promise<void>) => void;
    this.flight = new Promise<void>((resolve) => { settle = resolve; });
    settle(this.writeQueued());
  }

  private async writeQueued(): Promise<void> {
    try {
      while (this.next && !this.halted && !this.closedBy && !this.adopting && (this.stopped || this.profile !== null)) {
        const candidate = this.next;
        this.next = null;
        await this.save(candidate);
      }
    } finally {
      this.flight = null;
      this.emit();
    }
  }

  private async save(candidate: Candidate): Promise<void> {
    this.saving = true;
    this.emit();
    try {
      const covers = this.stopped
        ? await this.saveUncovered(candidate.doc, this.stopped)
        : await this.saveCovered(candidate);
      if (covers && candidate.gen === this.gen && !this.next) this.cleanGen = candidate.gen;
      this.failure = null;
    } catch (error) {
      this.failure = failureOf(error);
      if (HALTING.has(this.failure)) this.halted = true;
      await this.refresh();
    } finally {
      this.saving = false;
      this.emit();
    }
  }

  /** True when the journal now holds exactly `candidate`'s text. */
  private async saveCovered(candidate: Candidate): Promise<boolean> {
    const { journal } = this.deps;
    const recorder = this.recorder!;
    recorder.close();
    let lastDocument: string | null = null;
    for (;;) {
      if (this.ended) return false;
      const contents = await this.readJournal();
      const { meta, snapshot } = contents;
      if (!meta?.evidenceHead || !snapshot || meta.localSeq !== this.seq) {
        throw Object.assign(new Error("journal moved"), { code: "stale_local_sequence" });
      }
      // P1 (#476 c.6395903987): a capture failure during this save takes nothing more.
      if (this.stopped) {
        this.unsaved = null;
        return this.saveUncovered(candidate.doc, this.stopped);
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
          if (!(error instanceof CaptureError)) throw error;
          return this.saveUncovered(candidate.doc, error.code);
        }
      }
      if (built === null) {
        lastDocument ??= canonicalizeJcs(snapshot.document);
        break;
      }
      const replay = await replayEvidenceSegmentsV2(
        snapshot.document as unknown as JcsJsonValue, [built.segment], this.deps.replayer());
      if (!replay.ok || replay.documentSha256 !== built.segment.finalDocumentHash) {
        this.unsaved = null;
        return this.saveUncovered(candidate.doc, "unsupported_step");
      }
      // §4: the session may have closed (submission or close()) during the build or replay.
      if (this.ended) return false;
      // P1: a capture failure during the build or replay keeps the segment out of the chain.
      if (this.stopped) {
        this.unsaved = null;
        return this.saveUncovered(candidate.doc, this.stopped);
      }
      // The journal never takes a snapshot over the limit: stop evidence here
      // instead of keeping a segment that no retry can write.
      if (built.document.byteLength > MAX_DOCUMENT_SNAPSHOT_BYTES) {
        this.unsaved = null;
        return this.saveUncovered(candidate.doc, "too_large");
      }
      this.unsaved = built;
      const result = this.verified
        ? await journal.saveSegment(this.id, built, this.now().toISOString(), this.seq, this.verified)
        : await journal.saveSegment(this.id, built, this.now().toISOString(), this.seq);
      this.unsaved = null;
      this.seq = result.localSeq;
      this.stored = result.meta.state;
      this.syncedHere = false;
      this.owed += 1;
      lastDocument = decoder.decode(built.document);
      this.retryOpen();
      this.kick();
    }
    // Nothing recorded since the proposal: the journal must now hold its exact
    // bytes, else a change escaped the recorder and the chain cannot cover it.
    if (candidate.marks !== this.recorded) return false;
    if (lastDocument !== canonicalizeJcs(candidate.doc)) return this.saveUncovered(candidate.doc, "gap");
    return true;
  }

  private async saveUncovered(doc: SheetDocument, reason: EvidenceStop): Promise<boolean> {
    // §4: nothing is written once the session closed.
    if (this.ended) return false;
    this.stopped = reason;
    const meta = this.verified
      ? await this.deps.journal.saveUncovered(this.id, doc, reason, this.now().toISOString(), this.seq, this.verified)
      : await this.deps.journal.saveUncovered(this.id, doc as CanonicalDocument, reason, this.now().toISOString(), this.seq);
    this.seq = meta.localSeq;
    this.stored = meta.state;
    this.syncedHere = false;
    return true;
  }

  private kick(): void {
    if (this.stepping) {
      this.stepAgain = true;
      return;
    }
    if (!this.runner || this.halted || this.closedBy || this.paused || this.adopting || !this.deps.network.online()) return;
    this.clearTimer();
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
      if (result.kind === "sent" && result.state === "SYNCED") this.syncedHere = true;
      const contents = await this.refresh();
      if (result.kind === "sent" && contents && contents.pending.length > 0) continue;
      if (result.kind === "waiting" && !this.closed && !this.closedBy) {
        const set = this.deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
        this.timer = set(() => { this.timer = null; this.kick(); }, Math.max(0, result.notBefore - this.clock()));
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
        if (STICKY.has(contents.meta.state)) this.halted = true;
      }
      this.emit();
      return contents;
    } catch {
      return null;
    }
  }

  /**
   * Opens again while the work is unknown (§2 t. 4): on `online` and after
   * each saved segment. Never while paused (the sign-out dialog) or ended
   * (F-154): `resume()` leaves it to the next `online` or saved segment.
   */
  private retryOpen(): void {
    if (this.work || this.opening || this.paused || this.ended || !this.deps.network.online()) return;
    this.opening = this.openSafely().then(async (opened) => {
      if (opened.status !== "opened" || this.closed) return;
      // PIL-K-V3-BEZ-MREZE: a v3 work opened from its stored opening is
      // verified again against the server's answer, which takes its place.
      const fresh = this.deps.schemaVersion === 3 ? await verifiedV3(this.id, opened.work).catch(() => null) : null;
      if (this.closed || this.work) return;
      if (opened.work.documentId !== this.id || (this.deps.schemaVersion === 3 && !fresh)) {
        this.failure = "unavailable";
        this.halted = true;
        return;
      }
      if (fresh) this.verified = fresh;
      this.work = opened.work;
      if (opened.work.submitted) {
        // O2 also when the first open could not be reached (Codex #818
        // r4380722769): close as `load()` does, before any runner exists.
        this.closeBySubmission();
        return;
      }
      this.profile = opened.work.evidenceProfileId;
      this.runner = fresh ? this.deps.createRunner(opened.work, fresh) : this.deps.createRunner(opened.work);
      this.startWrites();
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

  /** The stored verified opening of this v3 work (`readVerifiedWork`), or null; never a throw. */
  private async storedV3(): Promise<VerifiedWorkOpening | null> {
    try {
      const stored = await this.deps.journal.readVerifiedWork?.(this.id);
      return stored?.schemaVersion === 3 ? stored : null;
    } catch {
      return null;
    }
  }

  /** The journal's contents; a v3 work's only under its verified opening. */
  private readJournal(): Promise<Contents> {
    return this.verified ? this.deps.journal.readEvidence(this.id, this.verified) : this.deps.journal.readEvidence(this.id);
  }

  /**
   * PIL-K-V3-OPORAVAK: leaves CONFLICT or RECOVERY_REQUIRED (or a stopped
   * record that owes nothing) the one way the journal allows, by taking the
   * server's version and keeping the local text as a copy (3d-2b,
   * `adoptServerEvidence`). The server's version is asked for now: a v1
   * session hands it over as before, a v3 session only once it is verified
   * again as this v3 work (`verifiedV3`), since the server's revision moved
   * past the one verified at load. `confirmed` is the author's word.
   */
  async adoptServer(confirmed: boolean): Promise<AdoptResult> {
    const { journal } = this.deps;
    if (this.closed || this.adopting || !journal.adoptServerEvidence) return { kind: "unavailable" };
    // Review c.7099383404: a write the take overtook would fail on the sequence
    // and its text would be neither in the snapshot nor in the copy, so no
    // write or drain step starts from here until the journal answered.
    this.adopting = true;
    this.clearTimer();
    // Review c.7099657848: only a record stopped at entry, in a session that
    // still writes, keeps a late text without evidence; a halted session
    // (CONFLICT, RECOVERY_REQUIRED) writes none and its held text is stale.
    const keepsLate = this.stopped !== null && !this.halted;
    let result: AdoptResult = { kind: "unavailable" };
    try {
      await this.settled();
      const opened = await this.openSafely();
      if (this.closed || opened.status !== "opened" || opened.work.documentId !== this.id) return result;
      let fresh: VerifiedWorkOpening | null = null;
      if (this.deps.schemaVersion === 3) {
        try {
          fresh = await verifiedV3(this.id, opened.work);
        } catch {
          fresh = null;
        }
        if (!fresh) return result;
      }
      if (this.closed) return result;
      // A text proposed meanwhile is written first (in `finally`); the author decides again.
      if (keepsLate && (this.flight || this.next || this.unsaved)) return (result = { kind: "refused", code: "pending_write" });
      const decidedAt = this.now().toISOString();
      let meta: SyncMeta;
      try {
        meta = fresh
          ? await journal.adoptServerEvidence(this.id, opened.work, confirmed, decidedAt, this.seq, fresh)
          : await journal.adoptServerEvidence(this.id, opened.work, confirmed, decidedAt, this.seq);
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        return (result = { kind: "refused", code: typeof code === "string" ? code : "unknown" });
      }
      result = { kind: "adopted", meta };
      this.seq = meta.localSeq;
      this.stored = meta.state;
      this.syncedHere = false;
      // A text proposed while the journal took the server's version stays on
      // this device over it, without evidence, as text written after a stop.
      const late = this.next as Candidate | null; // set meanwhile by `propose`
      this.next = null;
      if (late && keepsLate && !this.closed) {
        try {
          await this.saveUncovered(late.doc, this.stopped ?? "gap");
        } catch (error) {
          this.failure = failureOf(error);
        }
      }
      // Nothing more is written by this session: a new one loads the server's version.
      this.close();
      return result;
    } finally {
      this.adopting = false;
      if (result.kind !== "adopted") {
        this.startWrites();
        this.kick();
      }
      this.emit();
    }
  }

  /**
   * F4-EDI-R05: the server's version of the work, for the difference the
   * author sees before choosing a way out of a sticky state. Read only: the
   * answer is asked for now, a v3 work only once it is verified again as this
   * v3 work, and nothing is written. Null when there is no answer, it is
   * another work's, it cannot be verified, or its document is not valid.
   */
  async serverVersion(): Promise<SheetDocument | null> {
    if (this.closed) return null;
    try {
      const opened = await this.openSafely();
      if (this.closed || opened.status !== "opened" || opened.work.documentId !== this.id) return null;
      if (this.deps.schemaVersion === 3 && !(await verifiedV3(this.id, opened.work))) return null;
      const parsed: unknown = JSON.parse(new TextDecoder().decode(opened.work.document));
      const valid = this.deps.schemaVersion === 3 ? validV3(parsed) : validateDocument(parsed);
      return valid.ok ? valid.doc : null;
    } catch {
      return null;
    }
  }

  /**
   * The copies `adoptServer` kept, newest first, read as the session reads
   * its journal: a v3 session's only under its verified opening. Null when
   * they cannot be read (no verified v3 opening, a journal error).
   */
  async salvage(): Promise<SalvageCopy<VersionedDocument>[] | null> {
    const { journal } = this.deps;
    if (!journal.readSalvage || (this.deps.schemaVersion === 3 && !this.verified)) return null;
    try {
      return this.verified ? await journal.readSalvage(this.id, this.verified) : await journal.readSalvage(this.id);
    } catch {
      return null;
    }
  }

  /** The rows this journal holds for the document, read as the session reads them (sign-out dialog). */
  async heldRows(): Promise<number> {
    return (await this.readJournal()).pending.length;
  }

  private haltLoad(failure: SaverFailure, result: LoadResult<SheetDocument> = { kind: "unavailable" }): LoadResult<SheetDocument> {
    this.halted = true;
    this.failure = failure;
    this.emit();
    return result;
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    (this.deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.timer);
    this.timer = null;
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

/**
 * PIL-K-SPREMANJE-V3: the open answer verified as a v3 work, or null. A
 * later revision needs the server's revision zero hash (work-opening.ts); an
 * answer for any other version is never taken into a v3 session.
 */
async function verifiedV3(documentId: string, work: OpenedWork): Promise<VerifiedWorkOpening | null> {
  if (work.schemaVersion !== 3) return null;
  const proof = work.revisionZeroHash === undefined ? undefined : { documentId, sha256: work.revisionZeroHash };
  const verified = await verifyWorkOpening(documentId, work, proof);
  return verified?.schemaVersion === 3 ? verified : null;
}

/** A stored v3 snapshot, or the refusal `validateDocument` would give for any other. */
function validV3(document: unknown): { ok: true; doc: CanonicalDocumentV3 } | { ok: false } {
  const valid = validateVersionedDocument(document);
  return valid.ok && valid.doc.schemaVersion === 3 ? { ok: true, doc: valid.doc } : { ok: false };
}
