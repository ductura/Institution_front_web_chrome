// Rhythm of input (P-1, C-14 and N-1 of the constitution draft, status PRIJEDLOG): what the report
// "Podrijetlo teksta" may show per burst, and nothing else. A graph of the gaps, the duration, the
// number of characters and the longest pause; no speed, score, average, comparison or person. Until the
// legal opinion (N-3) only invented records reach this view (catalogue, demo).

/** At most this many gaps are kept per burst (P-1, PRODUCT §5 rule 4). */
export const MAX_RHYTHM_INTERVALS = 130;

export type RhythmBurst = {
  /** Whole milliseconds from the first to the last input of the burst. */
  readonly durationMs: number;
  /** Characters typed in the burst (code points). */
  readonly chars: number;
  readonly longestPauseMs: number;
  /** The gaps between inputs, in order, the first 130 of the burst. */
  readonly intervalsMs: readonly number[];
};

export type RhythmRecord = {
  /** False when the task teacher switched the recording of rhythm off (C-14): nothing else is shown. */
  readonly recorded: boolean;
  readonly bursts: readonly RhythmBurst[];
  readonly notice: "not_authorship_evidence";
};

const isCount = (n: number) => Number.isInteger(n) && n >= 0;

/**
 * Whether a record can be shown as it is. Anything that contradicts itself (a gap longer than the
 * longest pause, a burst shorter than its longest pause, more than 130 gaps) is not shown at all.
 */
export function rhythmIsConsistent(record: RhythmRecord): boolean {
  if (record.notice !== "not_authorship_evidence") return false;
  if (!record.recorded) return record.bursts.length === 0;
  return record.bursts.every((b) =>
    isCount(b.durationMs) && isCount(b.chars) && isCount(b.longestPauseMs) &&
    b.intervalsMs.length <= MAX_RHYTHM_INTERVALS && b.intervalsMs.every(isCount) &&
    b.intervalsMs.every((ms) => ms <= b.longestPauseMs) &&
    b.longestPauseMs <= b.durationMs &&
    (b.intervalsMs.length === 0 || Math.max(...b.intervalsMs) === b.longestPauseMs || b.intervalsMs.length === MAX_RHYTHM_INTERVALS),
  );
}

/** Seconds with one decimal, Croatian decimal comma: 1530 → "1,5". */
export function secondsText(ms: number): string {
  return (Math.round(ms / 100) / 10).toFixed(1).replace(".", ",");
}

/**
 * Heights of the gap bars, 0 to 1, against the longest pause of the same burst only: a burst is
 * never scaled against another burst, a person or a norm.
 */
export function barHeights(burst: RhythmBurst): number[] {
  const top = burst.longestPauseMs;
  return burst.intervalsMs.map((ms) => (top === 0 ? 0 : ms / top));
}
