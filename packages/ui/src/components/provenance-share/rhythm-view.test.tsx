// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { RhythmView, type RhythmViewLabels, type RhythmViewState } from "./RhythmView";
import { barHeights, MAX_RHYTHM_INTERVALS, rhythmIsConsistent, secondsText, type RhythmBurst, type RhythmRecord } from "./rhythm-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: RhythmViewLabels = {
  title: "Ritam unosa",
  notice: "Prikazuje samo kako je tekst unesen. Ne pokazuje tko je autor teksta.",
  off: "Bilježenje ritma isključeno je za ovaj zadatak.",
  empty: "Nema zabilježenih naleta tipkanja.",
  burst: "Nalet {n}",
  duration: "trajanje",
  chars: "znakova",
  longestPause: "najdulja stanka",
  seconds: "s",
  graph: "Razmaci između unosa u naletu {n}",
  loading: "Učitavam ritam unosa.",
  none: "Za ovu predaju nema zapisa ritma.",
  error: "Ritam unosa trenutačno nije moguće prikazati.",
};

// Invented bursts.
const burst = (intervalsMs: number[], extra: Partial<RhythmBurst> = {}): RhythmBurst => ({
  durationMs: intervalsMs.reduce((a, b) => a + b, 0),
  chars: intervalsMs.length + 1,
  longestPauseMs: Math.max(0, ...intervalsMs),
  intervalsMs,
  ...extra,
});
const record = (bursts: RhythmBurst[], recorded = true): RhythmRecord => ({ recorded, bursts, notice: "not_authorship_evidence" });

let root: Root | null = null;
let host: HTMLElement | null = null;
function render(state: RhythmViewState, l: RhythmViewLabels = labels) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<RhythmView labels={l} state={state} />));
  return host;
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

describe("rhythm logic", () => {
  it("accepts a consistent record and refuses one that contradicts itself", () => {
    expect(rhythmIsConsistent(record([burst([120, 300, 90])]))).toBe(true);
    expect(rhythmIsConsistent(record([burst([120, 300], { longestPauseMs: 200 })]))).toBe(false);
    expect(rhythmIsConsistent(record([burst([120, 300], { durationMs: 100 })]))).toBe(false);
    expect(rhythmIsConsistent(record([burst(Array(MAX_RHYTHM_INTERVALS + 1).fill(100))]))).toBe(false);
    expect(rhythmIsConsistent(record([burst([100])], false))).toBe(false);
    expect(rhythmIsConsistent(record([], false))).toBe(true);
  });

  it("allows a longest pause past the first 130 gaps", () => {
    const kept = Array(MAX_RHYTHM_INTERVALS).fill(100);
    expect(rhythmIsConsistent(record([burst(kept, { longestPauseMs: 900, durationMs: 20000 })]))).toBe(true);
  });

  it("scales bars against the longest pause of the same burst only, and prints seconds with a comma", () => {
    expect(barHeights(burst([100, 400, 200]))).toEqual([0.25, 1, 0.5]);
    expect(secondsText(1530)).toBe("1,5");
  });
});

describe("RhythmView", () => {
  it("shows per burst the duration, characters, longest pause and a graph, with the notice", async () => {
    const el = render({ kind: "ready", rhythm: record([burst([120, 300, 90]), burst([200, 1800])]) });
    expect(el.querySelectorAll('[data-part="burst"]')).toHaveLength(2);
    expect(el.textContent).toContain("Nalet 2");
    expect(el.textContent).toContain("najdulja stanka");
    expect(el.textContent).toContain("1,8 s");
    expect(el.querySelector("[data-notice]")?.textContent).toBe(labels.notice);
    expect(el.querySelectorAll('svg[data-part="gaps"] rect')).toHaveLength(5);
    // No speed, score or comparison is ever printed.
    expect(el.textContent).not.toMatch(/brzin|znakova u minuti|prosjek|ocjen|%/i);
    const result = await axe.run(el);
    expect(result.violations).toEqual([]);
  });

  it("says when the task teacher switched the recording off, and shows nothing else", () => {
    const el = render({ kind: "ready", rhythm: record([], false) });
    expect(el.textContent).toContain(labels.off);
    expect(el.querySelector('[data-part="burst"]')).toBeNull();
  });

  it("shows no number when the record contradicts itself or the notice is missing", () => {
    expect(render({ kind: "ready", rhythm: record([burst([300], { longestPauseMs: 100 })]) }).textContent).toContain(labels.error);
    act(() => root?.unmount()); host?.remove();
    expect(render({ kind: "ready", rhythm: record([burst([300])]) }, { ...labels, notice: " " }).textContent).toContain(labels.error);
  });
});
