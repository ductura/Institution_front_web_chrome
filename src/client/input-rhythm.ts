// Rhythm of entry and the kind of origin of an input (P-1, WEB-0910), behind a port.
// SRV-0910 is not merged, so there is no route and no wire shape here: `RhythmPort` is the
// smallest port the plan and the prototype need, and the fake in input-rhythm-fake.ts is the
// only adapter.
//
// What is kept, by construction (P-1 rule 4, Constitution v1.7 to v1.9):
// - gaps in milliseconds between inputs inside one burst, nothing else: no key, no character,
//   no text, no count of keys, no speed, average, profile or comparison;
// - at most MAX_GAPS_PER_BURST gaps per burst, thinned evenly (never the first or last lost);
// - the start of a burst on the minute, never to the second.
// The recorder has no method that takes a key or text, so there is nothing to leave out.

/** The closed list of origins of a change (SRV-0910 a). Order is the display order. */
export const ORIGIN_KINDS = [
  "typed",
  "assistant_inserted",
  "assistant_match",
  "imported_file",
  "pasted_known",
  "pasted_unknown",
] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

/** What a browser input reports about itself. Never the data of the input. */
export type InputKind = {
  /** `InputEvent.inputType`, e.g. `insertText`, `insertFromPaste`, `insertFromDrop`. */
  readonly inputType: string;
  /** The change comes from the assistant's insert action (the panel says so, not the DOM). */
  readonly fromAssistant?: boolean;
  /** The change comes from the import dialog (a file, never the clipboard). */
  readonly fromImport?: boolean;
};

/** One gap after another, thinned. A burst is the unit sent with a segment. */
export const MAX_GAPS_PER_BURST = 130;
/** A pause longer than this ends the burst. Assumption (P-1 gives none): 2 s, one constant. */
export const BURST_BREAK_MS = 2000;
/** A gap is never longer than the break, so a value cannot carry a long absence. */
export const MAX_GAP_MS = BURST_BREAK_MS;

export type RhythmBurst = {
  /** Start of the burst, rounded down to the minute (ms since the epoch). */
  readonly startedAtMinute: number;
  readonly gapsMs: readonly number[];
};

const MINUTE_MS = 60_000;

/**
 * The origin of one input, decided when it happens and never later (SRV-0910 a). A paste is
 * `pasted_unknown` until the student explains it (`explainPaste`); the original mark is kept
 * by the caller. Undo, redo and everything the DOM does not name are `null`: no kind is
 * guessed, so nothing is counted as typed that was not.
 */
export function originOfInput(input: InputKind): OriginKind | null {
  if (input.fromAssistant === true) return "assistant_inserted";
  if (input.fromImport === true) return "imported_file";
  switch (input.inputType) {
    case "insertText":
    case "insertCompositionText":
    case "insertLineBreak":
    case "insertParagraph":
      return "typed";
    case "insertFromPaste":
    case "insertFromPasteAsQuotation":
    case "insertFromDrop":
    case "insertFromYank":
      return "pasted_unknown";
    default:
      return null;
  }
}

/** The explained paste: `pasted_unknown` becomes `pasted_known`, any other kind stays. */
export function explainPaste(kind: OriginKind): OriginKind {
  return kind === "pasted_unknown" ? "pasted_known" : kind;
}

/** Thins to at most `max` values, evenly, keeping the first and the last. */
export function thinGaps(gaps: readonly number[], max: number = MAX_GAPS_PER_BURST): readonly number[] {
  if (gaps.length <= max) return gaps;
  if (max <= 1) return max === 1 ? [gaps[0]!] : [];
  const out: number[] = [];
  for (let i = 0; i < max; i += 1) out.push(gaps[Math.round((i * (gaps.length - 1)) / (max - 1))]!);
  return out;
}

export type RhythmRecorder = {
  /** One typed input happened. No argument: the recorder is never told which key. */
  noteTyped(): void;
  /** Any other change, or a pause the page knows about (blur, hidden): ends the burst. */
  breakBurst(): void;
  /** Hands over the closed bursts and the open one, and starts clean. */
  take(): readonly RhythmBurst[];
  /** The setting changed (the teacher's switch): off from now on, nothing earlier is touched. */
  setEnabled(enabled: boolean): void;
};

/**
 * The recorder. `now` is the clock; tests pass their own. With the setting off nothing is
 * measured and nothing is kept, and what was measured before stays only until `take`.
 */
export function createRhythmRecorder(now: () => number = () => Date.now(), enabled = true): RhythmRecorder {
  let on = enabled;
  let closed: RhythmBurst[] = [];
  let startedAt: number | null = null;
  let last = 0;
  let gaps: number[] = [];

  const close = () => {
    if (startedAt !== null && gaps.length > 0) {
      closed.push({ startedAtMinute: Math.floor(startedAt / MINUTE_MS) * MINUTE_MS, gapsMs: thinGaps(gaps) });
    }
    startedAt = null;
    gaps = [];
  };

  return {
    noteTyped() {
      if (!on) return;
      const t = now();
      if (startedAt === null) {
        startedAt = t;
      } else {
        const gap = t - last;
        if (gap > BURST_BREAK_MS || gap < 0) {
          close();
          startedAt = t;
        } else {
          gaps.push(Math.min(gap, MAX_GAP_MS));
        }
      }
      last = t;
    },
    breakBurst() {
      close();
    },
    take() {
      close();
      const out = closed;
      closed = [];
      return out;
    },
    setEnabled(next) {
      if (!next) close();
      on = next;
    },
  };
}

/** What goes with a segment: the origin of each change and the bursts, nothing else. */
export type RhythmPayload = {
  readonly origins: readonly { readonly kind: OriginKind; readonly codePoints: number }[];
  readonly bursts: readonly RhythmBurst[];
};

/**
 * The port of SRV-0910. `recording()` is the faculty's setting for this work: only a teacher
 * changes it (not the student), so there is no write method here for the student's side.
 */
export interface RhythmPort {
  recording(documentId: string): Promise<boolean>;
  send(documentId: string, payload: RhythmPayload): Promise<void>;
}
