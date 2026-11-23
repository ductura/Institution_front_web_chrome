import { describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../scripts/forbidden-terms/terms";
import { inputRhythmHr } from "../lib/i18n/messages.hr";
import {
  BURST_BREAK_MS, createRhythmPort, createRhythmRecorder, explainPaste, MAX_GAPS_PER_BURST, ORIGIN_KINDS, originOfInput, thinGaps,
} from "./input-rhythm";
import { createFakeRhythmPort } from "./input-rhythm-fake";
import { createApi } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };

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

// PIL-P1-RITAM-PREKIDAC: the setting the student sees and "Obriši zabilježeni ritam", through the real
// createApi and the contract's own vectors; every name, id and date in them is invented.
describe("rhythm setting and erase through createApi", () => {
  const BASE_URL = "https://ductura.example.invalid";
  const DOC = "izmisljeni-rad-0001";
  type Vector = { route: string; name: string; response: { status: number; body?: unknown } };
  const vector = (route: string, name: string) => {
    const found = (vectors as Vector[]).find((v) => v.route === route && v.name === name);
    if (found === undefined) throw new Error(`no vector ${route} ${name}`);
    return found.response;
  };
  const api = (status: number, body: unknown) => {
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
    return { call: createApi({ baseUrl: BASE_URL, fetchImpl }), fetchImpl };
  };
  const fromVector = (route: string, name: string) => { const r = vector(route, name); return api(r.status, r.body); };
  const teacher = { role: "teacher", name: "Izmišljena Nastavnica" } as const;

  it("reads the default, and a dated setting without source has no claimed level", async () => {
    const { call, fetchImpl } = fromVector("work.input-rhythm-setting.get", "default");
    expect(await createRhythmPort(call).setting(DOC)).toEqual({ kind: "ready", state: { enabled: true, level: "default", changedBy: null, changedAt: null } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/works/${DOC}/input-rhythm/setting`);
    expect(init?.method).toBe("GET");
    const off = await createRhythmPort(fromVector("work.input-rhythm-setting.get", "off").call).setting(DOC);
    expect(off).toEqual({ kind: "ready", state: { enabled: false, level: null, changedBy: teacher, changedAt: "2026-11-22T10:00:00.000Z" } });
  });

  it("names the level the server sends as source (SRV #652)", async () => {
    for (const source of ["assignment", "course", "default"] as const) {
      const body = { enabled: false, source, changedBy: teacher, changedAt: "2026-11-23T08:00:00.000Z" };
      const answer = await createRhythmPort(api(200, body).call).setting(DOC);
      expect(answer).toEqual({ kind: "ready", state: { enabled: false, level: source, changedBy: teacher, changedAt: body.changedAt } });
    }
  });

  it("negative control: 401 is signedOut, 404 and 503 the same unavailable, a body outside the contract never on", async () => {
    expect(await createRhythmPort(fromVector("work.input-rhythm-setting.get", "unauthorized").call).setting(DOC)).toEqual({ kind: "signedOut" });
    for (const name of ["not-found", "unavailable"]) {
      expect(await createRhythmPort(fromVector("work.input-rhythm-setting.get", name).call).setting(DOC)).toEqual({ kind: "unavailable" });
    }
    for (const body of [
      { enabled: "true", changedBy: null, changedAt: null },
      { enabled: true, source: "elsewhere", changedBy: null, changedAt: null },
      { enabled: true, changedBy: null, changedAt: null, keys: ["a"] },
    ]) {
      const port = createRhythmPort(api(200, body).call);
      expect(await port.setting(DOC)).toEqual({ kind: "unavailable" });
      expect(await port.recording(DOC)).toBe(false);
    }
    const offline = createApi({ baseUrl: BASE_URL, fetchImpl: vi.fn(async () => { throw new TypeError("offline"); }) });
    expect(await createRhythmPort(offline).setting(DOC)).toEqual({ kind: "unavailable" });
  });

  it("erases with one DELETE and reports only the count the server confirmed", async () => {
    const { call, fetchImpl } = fromVector("work.input-rhythm.delete", "deleted");
    expect(await createRhythmPort(call).erase(DOC)).toEqual({ kind: "deleted", count: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/works/${DOC}/input-rhythm`);
    expect(init?.method).toBe("DELETE");
    expect(await createRhythmPort(fromVector("work.input-rhythm.delete", "nothing").call).erase(DOC)).toEqual({ kind: "deleted", count: 0 });
  });

  it("negative control: a refused, malformed or failed erase is never reported as deleted", async () => {
    expect(await createRhythmPort(fromVector("work.input-rhythm.delete", "unauthorized").call).erase(DOC)).toEqual({ kind: "signedOut" });
    for (const name of ["not-found", "unavailable", "cross-site"]) {
      expect(await createRhythmPort(fromVector("work.input-rhythm.delete", name).call).erase(DOC)).toEqual({ kind: "unavailable" });
    }
    for (const body of [{ deleted: -1 }, {}, { deleted: 1.5 }]) {
      expect(await createRhythmPort(api(200, body).call).erase(DOC)).toEqual({ kind: "unavailable" });
    }
    const offline = createApi({ baseUrl: BASE_URL, fetchImpl: vi.fn(async () => { throw new TypeError("offline"); }) });
    expect(await createRhythmPort(offline).erase(DOC)).toEqual({ kind: "unavailable" });
  });
});
