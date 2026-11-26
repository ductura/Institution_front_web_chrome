// WEB-V14-SHEET-JOURNAL (val 14): the evidence of a spreadsheet work in the
// client, over the closed step format `ductus-sheet-steps-v1`
// (EVIDENCE_SHEET_TRANSACTION_FORMAT_V1 of the server, SRV-V14-SHEET-EVIDENCE).
// The twin of `document/forensics/slides-evidence.ts`, two parts:
//
//   - `createSheetReplayer`: the replayer behind the generic evidence replay.
//     It applies the steps of an event with the sheet's own `applySheetSteps`,
//     so what the client checks before it saves a segment is what the server
//     checks when it replays it.
//   - `SheetRecorder`: collects the steps the grid applied into events and
//     builds segments from the closed ones (same event rules as text and
//     slides: a quiet time, a 30 s span, one source per event, a change that
//     leaves the document as it was writes nothing).
//
// The recorder holds the document itself and applies every change through
// `applySheetSteps`: a change the replayer would refuse stops the recorder
// (nothing after it can be chained), it is never repaired or skipped. Time
// stays in the browser: an event has none, the segment names two whole minutes
// and the step offsets go to `timing` only.
import { evidenceSchemaForEvents, type EvidenceSource, type EvidenceStepV2, canonicalEvidenceSegment, type EvidenceSegment, type EvidenceEventV3 } from "../document/forensics/evidence-segment-v2";
import {
  EVIDENCE_CANONICALIZATION_V2, EVIDENCE_HASH_ALGORITHM_V2,
} from "../document/forensics/evidence-segment-v2";
import { exceedsEvidenceSegmentLimit } from "../document/forensics/evidence-chain-v2";
import {
  EvidenceContentNotSupportedV2, type AsyncEvidenceStepReplayerV2,
} from "../document/forensics/evidence-replay-v2";
import { sha256WebCrypto } from "../document/forensics/crypto";
import { type JcsJsonValue } from "../document/forensics/jcs";
import { sheetDocumentsEqual, type SheetDocument } from "../sheet/model";
import {
  SHEET_STEP_FORMAT_V1, applySheetSteps, parseSheetSteps, sheetDocumentSha256, sheetSnapshotBytes, type SheetStep,
} from "../sheet/steps";
import { validateSheetDocument } from "../sheet/validate";

const encoder = new TextEncoder();
const MINUTE_MS = 60_000;

/** A quiet time that closes an event, as for text (`EVENT_QUIET_MS`). */
export const SHEET_EVENT_QUIET_MS = 400;
/** Most events in one segment (the validator's limit). */
export const SHEET_MAX_SEGMENT_EVENTS = 5000;
/** Every segment spans less than this from its first change to its last (D-24). */
export const SHEET_MAX_SEGMENT_SPAN_MS = 30_000;

/** Replayer of `ductus-sheet-steps-v1` for `replayEvidenceSegmentsV2` in the browser. */
export function createSheetReplayer(): AsyncEvidenceStepReplayerV2<SheetDocument> {
  return {
    transactionFormat: SHEET_STEP_FORMAT_V1,
    load(canonical: JcsJsonValue): SheetDocument {
      const valid = validateSheetDocument(canonical);
      if (!valid.ok) throw new Error("invalid sheet document");
      return valid.value;
    },
    async apply(document, event): Promise<SheetDocument> {
      const parsed = parseSheetSteps(event.steps);
      // A step this client does not know is unreadable here, not shown to be wrong.
      if (!parsed.ok) throw new EvidenceContentNotSupportedV2("sheet-step");
      const applied = await applySheetSteps(document, parsed.steps);
      if (!applied.ok) throw new Error(`sheet step refused: ${applied.error}`);
      return applied.doc;
    },
    toCanonical: (document) => document as unknown as JcsJsonValue,
  };
}

/** Why the recorder stopped; the text after it is not covered by evidence (`EvidenceStop`). */
export type SheetCaptureFailure = "gap" | "unsupported_step" | "too_large";

export class SheetCaptureError extends Error {
  constructor(readonly code: SheetCaptureFailure) {
    super(`sheet evidence capture: ${code}`);
    this.name = "SheetCaptureError";
  }
}

/** One change the editor applied: the steps it is made of, its source and the time it entered. */
export type SheetChange = {
  steps: readonly SheetStep[];
  source: EvidenceSource;
  /** Epoch milliseconds when the change entered the editor. */
  at: number;
};

export type SheetSegmentContext = {
  documentId: string;
  sessionId: string;
  segmentId: string;
  evidenceProfileId: string;
  sequenceFrom: number;
  predecessorSegmentHash: string | null;
};

/** A segment built from closed events; assignable to the journal's `EvidenceSegmentInput`. */
export type BuiltSheetSegment = {
  segment: EvidenceSegment;
  /** Exact JCS bytes of the segment and their hash. */
  bytes: Uint8Array;
  sha256: string;
  /** Exact JCS bytes of the document after the last event (`finalDocumentHash`). */
  document: Uint8Array;
  timing: { segmentHash: string; sequenceFrom: number; events: { sequence: number; stepOffsetsMs: number[] }[] };
  eventCount: number;
};

type RawEvent = {
  source: EvidenceSource;
  changes: { steps: SheetStep[]; at: number }[];
  before: { sha256: string };
  after: { doc: SheetDocument; sha256: string };
};

const firstAt = (event: RawEvent) => event.changes[0]!.at;
const lastAt = (event: RawEvent) => event.changes[event.changes.length - 1]!.at;
const minute = (at: number) => new Date(Math.floor(at / MINUTE_MS) * MINUTE_MS).toISOString();

/**
 * Collects changes into events and builds segments from the closed ones. The
 * caller serialises `record` and `takeSegment` (neither is safe to run twice at
 * once); the document the recorder starts from is the journal's snapshot.
 */
export class SheetRecorder {
  private closed: RawEvent[] = [];
  private open: RawEvent | null = null;
  private current: SheetDocument;
  private currentSha: string | null = null;
  private lastTime: number | null = null;
  private failure: SheetCaptureFailure | null = null;

  constructor(initial: SheetDocument, private readonly quietMs = SHEET_EVENT_QUIET_MS) {
    this.current = initial;
  }

  /** False once a change could not be recorded: nothing after it can be chained. */
  get intact(): boolean {
    return this.failure === null;
  }

  /** Closed events not yet in a segment. */
  get pendingEvents(): number {
    return this.closed.length;
  }

  /** The document as the recorder holds it, after every change recorded so far. */
  get document(): SheetDocument {
    return this.current;
  }

  private stop(code: SheetCaptureFailure): never {
    this.failure ??= code;
    // The event the failure arose in, and every later one, never go out; the closed ones stay.
    this.open = null;
    throw new SheetCaptureError(code);
  }

  /**
   * Records one change. A change that leaves the document as it was is ignored.
   * Its time never goes back: a clock that does is held at the last time.
   */
  async record(change: SheetChange): Promise<void> {
    if (this.failure !== null) throw new SheetCaptureError(this.failure);
    if (change.steps.length === 0) return;
    const at = this.lastTime === null ? change.at : Math.max(change.at, this.lastTime);
    this.lastTime = at;
    const parsed = parseSheetSteps(change.steps);
    if (!parsed.ok) this.stop(parsed.error === "too_large" || parsed.error === "too_many_steps" ? "too_large" : "unsupported_step");
    let applied: Awaited<ReturnType<typeof applySheetSteps>>;
    try {
      applied = await applySheetSteps(this.current, parsed.steps);
    } catch {
      return this.stop("unsupported_step");
    }
    // A step the replayer would refuse leaves a hole no later segment can bridge.
    if (!applied.ok) return this.stop(applied.error === "too_large" ? "too_large" : "gap");
    if (sheetDocumentsEqual(this.current, applied.doc)) return;
    const before = this.currentSha ?? (this.currentSha = await sheetDocumentSha256(this.current));
    const after = await sheetDocumentSha256(applied.doc);
    if (
      this.open &&
      (this.open.source !== change.source ||
        at - lastAt(this.open) > this.quietMs ||
        at - firstAt(this.open) >= SHEET_MAX_SEGMENT_SPAN_MS)
    ) {
      this.close();
    }
    if (this.open) {
      this.open.changes.push({ steps: parsed.steps, at });
      this.open.after = { doc: applied.doc, sha256: after };
    } else {
      this.open = { source: change.source, changes: [{ steps: parsed.steps, at }], before: { sha256: before }, after: { doc: applied.doc, sha256: after } };
    }
    this.current = applied.doc;
    this.currentSha = after;
  }

  /** Closes the open event, e.g. when the drain is about to send. */
  close(): void {
    if (this.open) this.closed.push(this.open);
    this.open = null;
  }

  /**
   * The next segment from the oldest closed events, or null if none is closed.
   * It holds as many events as fit the event limit, the 30 s span and the
   * segment size; the rest stay for the next call. When the recorder stopped,
   * the events closed before the failure still come out, and only then does
   * this throw it.
   */
  async takeSegment(context: SheetSegmentContext): Promise<BuiltSheetSegment | null> {
    if (this.closed.length === 0) {
      if (this.failure !== null) throw new SheetCaptureError(this.failure);
      return null;
    }
    const startedAt = firstAt(this.closed[0]!);
    let count = 1;
    while (
      count < this.closed.length &&
      count < SHEET_MAX_SEGMENT_EVENTS &&
      lastAt(this.closed[count]!) - startedAt < SHEET_MAX_SEGMENT_SPAN_MS
    ) {
      count += 1;
    }
    for (;;) {
      let built: BuiltSheetSegment;
      try {
        built = await buildSegment(this.closed.slice(0, count), context);
      } catch (error) {
        this.failure ??= error instanceof SheetCaptureError ? error.code : "unsupported_step";
        this.closed = [];
        this.open = null;
        throw new SheetCaptureError(this.failure);
      }
      if (!exceedsEvidenceSegmentLimit(built.bytes.byteLength)) {
        this.closed.splice(0, count);
        return built;
      }
      if (count === 1) {
        this.failure ??= "too_large";
        this.closed = [];
        this.open = null;
        throw new SheetCaptureError("too_large");
      }
      count = Math.ceil(count / 2);
    }
  }
}

async function buildSegment(raw: readonly RawEvent[], context: SheetSegmentContext): Promise<BuiltSheetSegment> {
  const startedMs = Math.floor(firstAt(raw[0]!) / MINUTE_MS) * MINUTE_MS;
  const lastEvent = raw[raw.length - 1]!;
  const events: EvidenceEventV3[] = [];
  const timing: BuiltSheetSegment["timing"]["events"] = [];
  for (const [index, event] of raw.entries()) {
    const sequence = context.sequenceFrom + index;
    const steps: SheetStep[] = [];
    const offsets: number[] = [];
    for (const change of event.changes) {
      for (const step of change.steps) {
        steps.push(step);
        offsets.push(change.at - startedMs);
      }
    }
    const parsed = parseSheetSteps(steps);
    if (!parsed.ok) throw new SheetCaptureError(parsed.error === "too_large" || parsed.error === "too_many_steps" ? "too_large" : "unsupported_step");
    events.push({
      sequence,
      source: event.source,
      steps: parsed.steps as unknown as EvidenceStepV2[],
      beforeDocumentHash: event.before.sha256,
      afterDocumentHash: event.after.sha256,
    });
    timing.push({ sequence, stepOffsetsMs: offsets });
  }
  // The same schema rule as for text: v3 only for a `citation-form` event (never from here), so v2.
  const segment = {
    evidenceSchema: evidenceSchemaForEvents(events),
    canonicalization: EVIDENCE_CANONICALIZATION_V2,
    hashAlgorithm: EVIDENCE_HASH_ALGORITHM_V2,
    documentId: context.documentId,
    sessionId: context.sessionId,
    segmentId: context.segmentId,
    sequenceFrom: context.sequenceFrom,
    sequenceTo: context.sequenceFrom + raw.length - 1,
    observedStartedAt: minute(firstAt(raw[0]!)),
    observedEndedAt: minute(lastAt(lastEvent)),
    initialDocumentHash: raw[0]!.before.sha256,
    finalDocumentHash: lastEvent.after.sha256,
    predecessorSegmentHash: context.predecessorSegmentHash,
    events,
    // The editor model is a closed set of one (server/domain/forensics/evidence-segment-v2.ts);
    // the step format is what tells the readers this is a spreadsheet work.
    captureContext: { editorModel: "prosemirror", transactionFormat: SHEET_STEP_FORMAT_V1 },
    evidenceProfileId: context.evidenceProfileId,
  } as EvidenceSegment;
  let canonical: string;
  try {
    canonical = canonicalEvidenceSegment(segment, SHEET_STEP_FORMAT_V1);
  } catch {
    throw new SheetCaptureError("unsupported_step");
  }
  const sha256 = await sha256WebCrypto(canonical);
  return {
    segment,
    bytes: encoder.encode(canonical),
    sha256,
    document: sheetSnapshotBytes(lastEvent.after.doc),
    timing: { segmentHash: sha256, sequenceFrom: context.sequenceFrom, events: timing },
    eventCount: raw.length,
  };
}
