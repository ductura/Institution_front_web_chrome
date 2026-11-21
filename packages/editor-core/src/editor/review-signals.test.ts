import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import {
  BURST_QUIET_MS, changeShape, InputRhythm, MAX_INTERVALS_PER_BURST, PLACEHOLDER_THRESHOLDS, reviewFlags, type Burst,
} from "./review-signals";
import { createEditorExtensions } from "./schema";

const typed = (rhythm: InputRhythm, from: number, count: number, step: number) => {
  for (let i = 0; i < count; i += 1) rhythm.record({ at: from + i * step, inserted: 1, removed: 0, wentBack: false });
};

const burst = (over: Partial<Burst>): Burst => ({
  startedAt: 0, endedAt: 0, chars: 0, intervals: [], longestPauseMs: 0, wentBack: 0, removed: 0, ...over,
});

describe("InputRhythm", () => {
  it("closes a burst after the P-1 quiet time and starts a new one", () => {
    const rhythm = new InputRhythm();
    typed(rhythm, 0, 10, 150);
    typed(rhythm, 1350 + BURST_QUIET_MS + 1, 5, 150);
    const bursts = rhythm.bursts();
    expect(bursts.map((b) => b.chars)).toEqual([10, 5]);
    expect(bursts[0]!.intervals).toEqual(Array(9).fill(150));
    expect(bursts[0]!.longestPauseMs).toBe(150);
  });

  it("keeps at most 130 intervals per burst but counts every character", () => {
    const rhythm = new InputRhythm();
    typed(rhythm, 0, 500, 100);
    const [only] = rhythm.bursts();
    expect(only!.intervals).toHaveLength(MAX_INTERVALS_PER_BURST);
    expect(only!.chars).toBe(500);
  });

  it("hands out copies, never its own state", () => {
    const rhythm = new InputRhythm();
    typed(rhythm, 0, 3, 100);
    rhythm.bursts()[0]!.intervals.push(1);
    expect(rhythm.bursts()[0]!.intervals).toEqual([100, 100]);
  });
});

describe("reviewFlags", () => {
  const t = PLACEHOLDER_THRESHOLDS;

  it("R-1 only from the browser's own automation flag", () => {
    expect(reviewFlags([], { automated: true, rhythmRecorded: true })).toEqual([{ rule: "R-1", reason: "automated-browser" }]);
    expect(reviewFlags([], { automated: false, rhythmRecorded: true })).toEqual([]);
  });

  it("R-2 for a long burst with no pause; not computed with the rhythm off", () => {
    const long = burst({ chars: t.r2MinChars, longestPauseMs: t.r2MaxPauseMs, wentBack: 1 });
    expect(reviewFlags([long], { automated: false, rhythmRecorded: true })).toEqual([{ rule: "R-2", reason: "long-burst-without-pause", burst: 0 }]);
    expect(reviewFlags([long], { automated: false, rhythmRecorded: false })).toEqual([]);
    expect(reviewFlags([{ ...long, longestPauseMs: t.r2MaxPauseMs + 1 }], { automated: false, rhythmRecorded: true })).toEqual([]);
  });

  it("R-3 for a long burst that never goes back, also with the rhythm off", () => {
    const linear = burst({ chars: t.r3MinChars, longestPauseMs: 9999 });
    expect(reviewFlags([linear], { automated: false, rhythmRecorded: false })).toEqual([{ rule: "R-3", reason: "linear-burst", burst: 0 }]);
    expect(reviewFlags([{ ...linear, wentBack: 1 }], { automated: false, rhythmRecorded: false })).toEqual([]);
    expect(reviewFlags([{ ...linear, removed: t.r3MaxRemoved + 1 }], { automated: false, rhythmRecorded: false })).toEqual([]);
    expect(reviewFlags([{ ...linear, chars: t.r3MinChars - 1 }], { automated: false, rhythmRecorded: false })).toEqual([]);
  });
});

describe("changeShape", () => {
  const schema = getSchema(createEditorExtensions(""));
  const start = () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Prva rečenica ovdje")])]);
    const end = doc.content.size - 1;
    return EditorState.create({ doc, selection: TextSelection.create(doc, end) });
  };

  it("counts an insertion at the end, not going back", () => {
    const state = start();
    const tr = state.tr.insertText("x");
    const shape = changeShape([tr], state.selection.head, true);
    expect(shape).toMatchObject({ inserted: 1, removed: 0, wentBack: false });
    expect(shape.frontier).toBe(state.selection.head + 1);
  });

  it("a correction inside the last word is not going back", () => {
    const state = start();
    const end = state.selection.head;
    const tr = state.tr.delete(end - 2, end);
    expect(changeShape([tr], end, true)).toMatchObject({ removed: 2, wentBack: false });
  });

  it("an edit in an earlier word is going back", () => {
    const state = start();
    const end = state.selection.head;
    const tr = state.tr.insertText("X", 2, 2);
    expect(changeShape([tr], end, true).wentBack).toBe(true);
  });

  it("a change made with a selection is going back", () => {
    const state = start();
    const tr = state.tr.insertText("y");
    expect(changeShape([tr], state.selection.head, false).wentBack).toBe(true);
  });
});
