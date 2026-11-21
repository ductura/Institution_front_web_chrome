/**
 * Review flags for scripted input (P-2 proposal, docs/ductus/USTAV-DOPUNA-P2.md
 * in ductura/.github). PROPOSAL: built and tested on invented data only; not
 * wired into the product until the owner confirms P-1 and P-2.
 *
 * Pure: no DOM, no time source, no text. The caller passes, per change of the
 * author, when it happened, how many characters it inserted and removed, and
 * whether it went back into earlier text. What is kept per burst is the burst
 * of P-1 (intervals between inputs, at most 130) and a few counters. The flags
 * are fixed rules with published thresholds; there is no model and no score,
 * and a flag is never a claim about who wrote the text.
 */

import type { Transaction } from "@tiptap/pm/state";
import { ReplaceAroundStep, ReplaceStep } from "@tiptap/pm/transform";

/** A burst closes after this much quiet (P-1, prototype `mentor3.js`: 4 s). */
export const BURST_QUIET_MS = 4000;
/** Most intervals kept per burst (P-1, PRODUCT §5 rule 4). */
export const MAX_INTERVALS_PER_BURST = 130;

/** One change of the author, as the recorder needs it. */
export type InputChange = Readonly<{
  /** Milliseconds on any monotonic clock the caller keeps (performance.now). */
  at: number;
  inserted: number;
  removed: number;
  /**
   * The change edited text before the end of the last word typed, or came
   * with a non-empty selection: the author went back into earlier text.
   */
  wentBack: boolean;
}>;

export type Burst = {
  startedAt: number;
  endedAt: number;
  /** Characters inserted in the burst. */
  chars: number;
  /** Intervals between inputs in ms, the first 130 of the burst. */
  intervals: number[];
  longestPauseMs: number;
  wentBack: number;
  removed: number;
};

/**
 * Thresholds of rules R-2 and R-3. PLACEHOLDERS: P-2 §3 says they are set
 * from samples of people writing (src/components/editor/uzorci), so a person
 * almost never trips them, and published with the version. Do not tune them
 * against the red-team test.
 */
export type ReviewThresholds = Readonly<{
  /** R-2: a burst at least this long ... */
  r2MinChars: number;
  /** ... with no pause longer than this. */
  r2MaxPauseMs: number;
  /** R-3: a burst at least this long with no going back and little removal. */
  r3MinChars: number;
  r3MaxRemoved: number;
}>;

export const PLACEHOLDER_THRESHOLDS: ReviewThresholds = Object.freeze({
  r2MinChars: 400,
  r2MaxPauseMs: 2000,
  r3MinChars: 400,
  r3MaxRemoved: 5,
});

export type ReviewFlag = Readonly<
  | { rule: "R-1"; reason: "automated-browser" }
  | { rule: "R-2"; reason: "long-burst-without-pause"; burst: number }
  | { rule: "R-3"; reason: "linear-burst"; burst: number }
>;

/** Collects bursts from the author's changes. One per editor. */
export class InputRhythm {
  private readonly done: Burst[] = [];
  private open: Burst | null = null;

  record(change: InputChange): void {
    const burst = this.open;
    if (burst && change.at - burst.endedAt <= BURST_QUIET_MS) {
      const gap = Math.max(0, change.at - burst.endedAt);
      if (burst.intervals.length < MAX_INTERVALS_PER_BURST) burst.intervals.push(Math.round(gap));
      burst.longestPauseMs = Math.max(burst.longestPauseMs, gap);
      burst.endedAt = change.at;
      burst.chars += change.inserted;
      burst.removed += change.removed;
      if (change.wentBack) burst.wentBack += 1;
      return;
    }
    if (burst) this.done.push(burst);
    this.open = {
      startedAt: change.at, endedAt: change.at, chars: change.inserted, intervals: [],
      longestPauseMs: 0, wentBack: change.wentBack ? 1 : 0, removed: change.removed,
    };
  }

  /** Every burst so far, the open one last; copies. */
  bursts(): Burst[] {
    const all = this.open ? [...this.done, this.open] : [...this.done];
    return all.map((b) => ({ ...b, intervals: [...b.intervals] }));
  }
}

/**
 * The flags for one writing session, by the fixed rules of P-2 §3. R-4
 * (rhythm outside the range of people's samples) waits for the samples.
 */
export function reviewFlags(
  bursts: readonly Burst[],
  context: Readonly<{ automated: boolean; rhythmRecorded: boolean }>,
  t: ReviewThresholds = PLACEHOLDER_THRESHOLDS,
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  if (context.automated) flags.push({ rule: "R-1", reason: "automated-browser" });
  bursts.forEach((b, i) => {
    // P-2 §4: with the rhythm switched off, R-2 is not computed.
    if (context.rhythmRecorded && b.chars >= t.r2MinChars && b.longestPauseMs <= t.r2MaxPauseMs) {
      flags.push({ rule: "R-2", reason: "long-burst-without-pause", burst: i });
    }
    if (b.chars >= t.r3MinChars && b.wentBack === 0 && b.removed <= t.r3MaxRemoved) {
      flags.push({ rule: "R-3", reason: "linear-burst", burst: i });
    }
  });
  return flags;
}

/**
 * The shape of one change for `InputRhythm`: characters inserted and removed
 * and whether it went back before `frontier` (the end of the last word typed,
 * which the caller keeps as the return value). Text is counted, never kept.
 */
export function changeShape(
  transactions: readonly Transaction[],
  frontier: number,
  selectionWasEmpty: boolean,
): { inserted: number; removed: number; wentBack: boolean; frontier: number } {
  let inserted = 0;
  let removed = 0;
  let wentBack = !selectionWasEmpty;
  let end = frontier;
  for (const tr of transactions) {
    end = tr.mapping.map(end, 1);
    for (const step of tr.steps) {
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) continue;
      const { from, to, slice } = step;
      const text = slice.content.textBetween(0, slice.content.size, "", "");
      inserted += [...text].length;
      removed += Math.max(0, to - from);
      if (from < end - 1 && to <= end) {
        // Within the last word is a correction while typing, not going back.
        const before = tr.docs[tr.steps.indexOf(step)]!;
        const tail = before.textBetween(from, Math.min(end, before.content.size), " ", " ");
        if (/\s/.test(tail)) wentBack = true;
      }
    }
    const head = tr.selection.head;
    end = Math.max(end, head);
  }
  return { inserted, removed, wentBack, frontier: end };
}
