import { describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../scripts/forbidden-terms/terms";
import { inputRhythmHr } from "../lib/i18n/messages.hr";
import {
  BURST_BREAK_MS, createRhythmPort, createRhythmRecorder, explainPaste, MAX_GAPS_PER_BURST, ORIGIN_KINDS, originOfInput, thinGaps,
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

// PIL-P1-RITAM-EDITOR: the real adapter. A fake `call` stands for createApi; no request leaves.
describe("rhythm port over the server", () => {
  type Call = Parameters<typeof createRhythmPort>[0];
  const answering = (answer: (id: string) => unknown) => {
    const calls: { id: string; input: { params: unknown; body: unknown } }[] = [];
    const call = vi.fn(async (id: string, input: { params: unknown; body: unknown }) => {
      calls.push({ id, input });
      return answer(id);
    });
    return { call: call as unknown as Call, calls };
  };
  const ok = (body: unknown) => ({ ok: true, status: 200, body, headers: {} });

  it("records only when the switch of the work says exactly enabled: true", async () => {
    for (const [answer, on] of [
      [ok({ enabled: true, changedBy: null, changedAt: null }), true],
      [ok({ enabled: false, changedBy: null, changedAt: null }), false],
      [{ ok: false, status: 404, code: "not_found" }, false],
      [{ ok: false, status: 401, code: "session_expired" }, false],
    ] as const) {
      const { call, calls } = answering(() => answer);
      expect(await createRhythmPort(call).recording("doc-1")).toBe(on);
      expect(calls).toEqual([{ id: "work.input-rhythm-setting.get", input: { params: { documentId: "doc-1" }, query: undefined, body: undefined } }]);
    }
    const thrown = createRhythmPort((async () => { throw new TypeError("offline"); }) as unknown as Call);
    expect(await thrown.recording("doc-1")).toBe(false);
  });

  it("posts each burst as { gapsMs } alone: no key, text, origin, time or speed", async () => {
    const { call, calls } = answering(() => ok({ recorded: true }));
    await createRhythmPort(call).send("doc-1", {
      origins: [{ kind: "typed", codePoints: 40 }, { kind: "pasted_unknown", codePoints: 0 }],
      bursts: [
        { startedAtMinute: 1_700_000_040_000, gapsMs: [120, 95, 2000] },
        { startedAtMinute: 1_700_000_100_000, gapsMs: [] },
        { startedAtMinute: 1_700_000_160_000, gapsMs: [310] },
      ],
    });
    expect(calls.map((c) => c.id)).toEqual(["work.input-rhythm.post", "work.input-rhythm.post"]);
    expect(calls.map((c) => c.input.params)).toEqual([{ documentId: "doc-1" }, { documentId: "doc-1" }]);
    expect(calls.map((c) => c.input.body)).toEqual([{ gapsMs: [120, 95, 2000] }, { gapsMs: [310] }]);
    for (const { input } of calls) {
      expect(Object.keys(input.body as object)).toEqual(["gapsMs"]);
      expect((input.body as { gapsMs: unknown[] }).gapsMs.every((g) => Number.isInteger(g))).toBe(true);
    }
  });

  it("never throws on a refused or failed send, and goes on with the next burst", async () => {
    let n = 0;
    const call = (async () => {
      n += 1;
      if (n === 1) throw new TypeError("offline");
      return { ok: false, status: 503, code: "unavailable" };
    }) as unknown as Call;
    await expect(createRhythmPort(call).send("doc-1", {
      origins: [],
      bursts: [{ startedAtMinute: 0, gapsMs: [100] }, { startedAtMinute: 0, gapsMs: [200] }],
    })).resolves.toBeUndefined();
    expect(n).toBe(2);
  });
});
