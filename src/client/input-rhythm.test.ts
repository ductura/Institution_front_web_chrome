import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../scripts/forbidden-terms/terms";
import { inputRhythmHr } from "../lib/i18n/messages.hr";
import {
  BURST_BREAK_MS, createRhythmRecorder, explainPaste, MAX_GAPS_PER_BURST, ORIGIN_KINDS, originOfInput, thinGaps,
} from "./input-rhythm";
import { createFakeRhythmPort } from "./input-rhythm-fake";

function clock() {
  let t = 1_700_000_000_000;
  return { now: () => t, tick: (ms: number) => { t += ms; } };
}

describe("origin of an input", () => {
  it("names typed, pasted and assistant or import inputs and guesses nothing else", () => {
    expect(originOfInput({ inputType: "insertText" })).toBe("typed");
    expect(originOfInput({ inputType: "insertFromPaste" })).toBe("pasted_unknown");
    expect(originOfInput({ inputType: "insertFromDrop" })).toBe("pasted_unknown");
    expect(originOfInput({ inputType: "insertText", fromAssistant: true })).toBe("assistant_inserted");
    expect(originOfInput({ inputType: "insertFromPaste", fromImport: true })).toBe("imported_file");
    expect(originOfInput({ inputType: "historyUndo" })).toBeNull();
    expect(ORIGIN_KINDS).toHaveLength(6);
  });
  it("explaining a paste changes only pasted_unknown", () => {
    expect(explainPaste("pasted_unknown")).toBe("pasted_known");
    expect(explainPaste("typed")).toBe("typed");
  });
});

describe("rhythm recorder", () => {
  it("keeps gaps in ms inside a burst and the start on the minute", () => {
    const c = clock();
    const r = createRhythmRecorder(c.now);
    r.noteTyped(); c.tick(120); r.noteTyped(); c.tick(80); r.noteTyped();
    const [burst] = r.take();
    expect(burst!.gapsMs).toEqual([120, 80]);
    expect(burst!.startedAtMinute % 60_000).toBe(0);
  });
  it("ends the burst on a long pause and on breakBurst", () => {
    const c = clock();
    const r = createRhythmRecorder(c.now);
    r.noteTyped(); c.tick(100); r.noteTyped(); c.tick(BURST_BREAK_MS + 1); r.noteTyped(); c.tick(50); r.noteTyped(); r.breakBurst(); c.tick(10); r.noteTyped();
    expect(r.take().map((b) => b.gapsMs)).toEqual([[100], [50]]);
  });
  it("thins to at most 130 values keeping the first and the last", () => {
    const gaps = Array.from({ length: 1000 }, (_, i) => i);
    const out = thinGaps(gaps);
    expect(out).toHaveLength(MAX_GAPS_PER_BURST);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(999);
  });
  it("records nothing while off and stops from the moment of the switch", () => {
    const c = clock();
    const r = createRhythmRecorder(c.now, false);
    r.noteTyped(); c.tick(10); r.noteTyped();
    expect(r.take()).toEqual([]);
    r.setEnabled(true);
    r.noteTyped(); c.tick(10); r.noteTyped(); r.setEnabled(false); c.tick(10); r.noteTyped();
    expect(r.take()).toHaveLength(1);
    expect(r.take()).toEqual([]);
  });
  it("holds no key and no speed: nothing derived leaves the recorder", () => {
    const c = clock();
    const r = createRhythmRecorder(c.now);
    r.noteTyped(); c.tick(90); r.noteTyped();
    const json = JSON.stringify(r.take());
    expect(Object.keys(JSON.parse(json)[0]).sort()).toEqual(["gapsMs", "startedAtMinute"]);
    expect(json).not.toMatch(/key|speed|wpm|average|mean|profile|char|text/i);
  });
});

describe("fake port and wording", () => {
  it("is on by default, honours the teacher's switch and keeps what was sent", async () => {
    const p = createFakeRhythmPort();
    expect(await p.recording("d")).toBe(true);
    await p.send("d", { origins: [], bursts: [] });
    p.setRecording("d", false);
    expect(await p.recording("d")).toBe(false);
    await p.send("d", { origins: [], bursts: [] });
    expect(p.sent).toHaveLength(1);
  });
  it("keeps the wording clear of forbidden terms", () => {
    expect(inputRhythmHr.toggle).toBe("Bilježi ritam tipkanja");
    expect(findForbiddenTerms(JSON.stringify(inputRhythmHr), "hr")).toEqual([]);
  });
});
