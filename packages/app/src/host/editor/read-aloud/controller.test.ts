import { describe, expect, it, vi } from "vitest";

import { clampRate, createReadAloud, type ReadAloudState } from "./controller";
import { pickVoice, readAloudSupported, type ReadAloudHost, type SpeechUtteranceLike, type SpeechVoice } from "./support";

// WEB-V20-NAGLAS-JEZGRA: invented text only; fake speechSynthesis.
function fakeHost(voices: SpeechVoice[] = []) {
  const spoken: (SpeechUtteranceLike & { text: string })[] = [];
  const calls: string[] = [];
  class Utterance {
    lang = ""; rate = 1; voice: SpeechVoice | null = null;
    onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: ((e: { error?: string }) => void) | null = null;
    constructor(public text: string) {}
  }
  const host: ReadAloudHost = {
    SpeechSynthesisUtterance: Utterance as never,
    speechSynthesis: {
      speak: (u) => { calls.push("speak"); spoken.push(u as never); },
      cancel: () => { calls.push("cancel"); },
      pause: () => { calls.push("pause"); },
      resume: () => { calls.push("resume"); },
      getVoices: () => voices,
    },
  };
  const endCurrent = () => spoken[spoken.length - 1]?.onend?.();
  return { host, spoken, calls, endCurrent };
}

describe("support", () => {
  it("reports unsupported without synthesiser or utterance class", () => {
    expect(readAloudSupported({})).toBe(false);
    expect(readAloudSupported({ speechSynthesis: fakeHost().host.speechSynthesis })).toBe(false);
    expect(readAloudSupported(fakeHost().host)).toBe(true);
  });
  it("prefers hr-HR, then any hr, else falls back with a flag", () => {
    const en = { lang: "en-US", name: "En", voiceURI: "en" };
    const hr = { lang: "hr-HR", name: "Hr", voiceURI: "hr" };
    expect(pickVoice([en, hr])).toEqual({ voice: hr, fallback: false });
    expect(pickVoice([en, { lang: "hr", name: "x", voiceURI: "x" }]).fallback).toBe(false);
    expect(pickVoice([en])).toEqual({ voice: null, fallback: true });
  });
});

describe("createReadAloud", () => {
  it("clamps the rate to 0.75..1.5", () => {
    expect(clampRate(0.1)).toBe(0.75);
    expect(clampRate(9)).toBe(1.5);
    expect(clampRate(1.25)).toBe(1.25);
    expect(clampRate(Number.NaN)).toBe(1);
  });

  it("is unsupported and speaks nothing in an unsupported browser", () => {
    const states: ReadAloudState[] = [];
    const c = createReadAloud({ onStateChange: (s) => states.push(s) }, {});
    expect(c.state).toBe("unsupported");
    expect(c.start("Tekst.")).toBe(false);
    expect(c.state).toBe("unsupported");
    expect(states).toEqual([]);
  });

  it("refuses empty text without touching the synthesiser", () => {
    const f = fakeHost();
    const c = createReadAloud({}, f.host);
    expect(c.start("   ")).toBe(false);
    expect(f.calls).toEqual([]);
    expect(c.state).toBe("idle");
  });

  it("reads chunk by chunk in order with start/end callbacks, hr-HR voice and rate", () => {
    const hr = { lang: "hr-HR", name: "Hr", voiceURI: "hr" };
    const f = fakeHost([hr]);
    const log: string[] = [];
    const finished = vi.fn();
    const c = createReadAloud({
      onChunkStart: (ch, i) => log.push(`start${i}:${ch.text}`),
      onChunkEnd: (_ch, i) => log.push(`end${i}`),
      onFinish: finished,
    }, f.host, 1.25);
    expect(c.start("Prva. Druga.")).toBe(true);
    expect(c.state).toBe("reading");
    expect(f.spoken).toHaveLength(1);
    expect(f.spoken[0]).toMatchObject({ text: "Prva.", lang: "hr-HR", rate: 1.25, voice: hr });
    f.spoken[0]?.onstart?.();
    f.endCurrent();
    expect(f.spoken.map((u) => u.text)).toEqual(["Prva.", "Druga."]);
    f.spoken[1]?.onstart?.();
    f.endCurrent();
    expect(log).toEqual(["start0:Prva.", "end0", "start1:Druga.", "end1"]);
    expect(finished).toHaveBeenCalledWith("completed");
    expect(c.state).toBe("idle");
    expect(c.voiceFallback).toBe(false);
  });

  it("uses the default voice with a note flag when there is no hr-HR voice", () => {
    const f = fakeHost([{ lang: "en-US", name: "En", voiceURI: "en" }]);
    const c = createReadAloud({}, f.host);
    c.start("Tekst.");
    expect(f.spoken[0]?.voice).toBeNull();
    expect(c.voiceFallback).toBe(true);
  });

  it("pauses, resumes and stops", () => {
    const f = fakeHost();
    const finished = vi.fn();
    const c = createReadAloud({ onFinish: finished }, f.host);
    c.start("Prva. Druga.");
    c.pause();
    expect(c.state).toBe("paused");
    c.resume();
    expect(c.state).toBe("reading");
    c.stop();
    expect(c.state).toBe("idle");
    expect(f.calls).toEqual(["cancel", "speak", "pause", "resume", "cancel"]);
    expect(finished).toHaveBeenCalledWith("stopped");
    c.pause(); // no-op when idle
    expect(f.calls.at(-1)).toBe("cancel");
  });

  it("cancels an older reading when a new one starts; the old callbacks stay silent", () => {
    const f = fakeHost();
    const log: string[] = [];
    const c = createReadAloud({ onChunkEnd: (ch) => log.push(ch.text) }, f.host);
    c.start("Stara prva. Stara druga.");
    const old = f.spoken[0];
    c.start("Nova.");
    expect(f.calls).toEqual(["cancel", "speak", "cancel", "speak"]);
    old?.onend?.(); // late event of the cancelled utterance
    expect(f.spoken).toHaveLength(2);
    expect(log).toEqual([]);
    f.endCurrent();
    expect(log).toEqual(["Nova."]);
  });

  it("ends with failed on a synthesis error and ignores errors of a stopped reading", () => {
    const f = fakeHost();
    const finished = vi.fn();
    const c = createReadAloud({ onFinish: finished }, f.host);
    c.start("Prva. Druga.");
    f.spoken[0]?.onerror?.({ error: "synthesis-failed" });
    expect(finished).toHaveBeenLastCalledWith("failed");
    expect(c.state).toBe("idle");
    c.start("Treća.");
    const stale = f.spoken.at(-1);
    c.stop();
    stale?.onerror?.({ error: "canceled" }); // browsers report cancel as an error
    expect(finished).toHaveBeenCalledTimes(2);
    expect(finished).toHaveBeenLastCalledWith("stopped");
  });

  it("applies a new rate from the next chunk", () => {
    const f = fakeHost();
    const c = createReadAloud({}, f.host);
    c.start("Prva. Druga.");
    c.setRate(1.5);
    f.endCurrent();
    expect(f.spoken.map((u) => u.rate)).toEqual([1, 1.5]);
  });
});
