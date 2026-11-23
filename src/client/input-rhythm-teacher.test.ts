import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import { assignmentRhythmPort, courseRhythmPort } from "./input-rhythm-teacher";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };

// The server's own answers come from the contract vectors (SRV #652); every id, name and date in them is invented.
const BASE_URL = "https://ductura.example.invalid";
const COURSE = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";
const TASK = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

type Vector = { route: string; name: string; response: { status: number; body?: unknown } };

function answerOf(route: string, name: string): Vector["response"] {
  const found = (vectors as Vector[]).find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`no vector ${route} ${name}`);
  return found.response;
}

function apiAnswering(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { call: createApi({ baseUrl: BASE_URL, fetchImpl }), fetchImpl };
}

function vectorApi(route: string, name: string) {
  const answer = answerOf(route, name);
  return apiAnswering(answer.status, answer.body);
}

describe("course switch", () => {
  it("reads the default and the course's own setting with the level the server names", async () => {
    expect(await courseRhythmPort(vectorApi("teacher.course-input-rhythm.get", "default").call, COURSE).read())
      .toEqual({ kind: "ready", state: { enabled: true, source: "default", changedBy: null, changedAt: null } });
    const off = await courseRhythmPort(vectorApi("teacher.course-input-rhythm.get", "off").call, COURSE).read();
    expect(off).toMatchObject({ kind: "ready", state: { enabled: false, source: "course" } });
  });

  it("sends one PUT to the course's route and holds only the value the server confirms", async () => {
    const { call, fetchImpl } = vectorApi("teacher.course-input-rhythm.put", "switched-off");
    expect(await courseRhythmPort(call, COURSE).set(false)).toMatchObject({ kind: "ready", state: { enabled: false, source: "course" } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/teacher/courses/${COURSE}/input-rhythm`);
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe('{"enabled":false}');
  });

  it("negative control: an answer naming the other value is not a confirmation", async () => {
    // The server answered "on" to "off": the screen must not show "off" as saved.
    const { call } = vectorApi("teacher.course-input-rhythm.put", "switched-on");
    expect(await courseRhythmPort(call, COURSE).set(false)).toEqual({ kind: "unavailable" });
  });

  it("401 is signedOut; 404 and 503 are the same unavailable, so existence is not told", async () => {
    expect(await courseRhythmPort(vectorApi("teacher.course-input-rhythm.get", "unauthorized").call, COURSE).read()).toEqual({ kind: "signedOut" });
    expect(await courseRhythmPort(vectorApi("teacher.course-input-rhythm.put", "unauthorized").call, COURSE).set(true)).toEqual({ kind: "signedOut" });
    const missing = await courseRhythmPort(vectorApi("teacher.course-input-rhythm.get", "not-found").call, COURSE).read();
    const down = await courseRhythmPort(vectorApi("teacher.course-input-rhythm.get", "unavailable").call, COURSE).read();
    expect(missing).toEqual({ kind: "unavailable" });
    expect(missing).toEqual(down);
    expect(await courseRhythmPort(vectorApi("teacher.course-input-rhythm.put", "not-found").call, COURSE).set(true)).toEqual({ kind: "unavailable" });
  });

  it("a broken connection or a body outside the contract is unavailable, never a state", async () => {
    const thrown = createApi({ baseUrl: BASE_URL, fetchImpl: vi.fn(async () => { throw new TypeError("offline"); }) });
    expect(await courseRhythmPort(thrown, COURSE).set(false)).toEqual({ kind: "unavailable" });
    const odd = apiAnswering(200, { enabled: false, source: "course", changedBy: null, changedAt: null, extra: 1 });
    expect(await courseRhythmPort(odd.call, COURSE).read()).toEqual({ kind: "unavailable" });
  });

  it("a malformed course id never reaches the network", async () => {
    const { call, fetchImpl } = vectorApi("teacher.course-input-rhythm.get", "default");
    expect(await courseRhythmPort(call, "../tecaj").read()).toEqual({ kind: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("assignment switch", () => {
  const ok = (route: string) => (vectors as Vector[]).filter((v) => v.route === route && v.response.status === 200);

  it("takes the level only from the server's source; an answer without it is unavailable, never guessed", async () => {
    // Driven by the extract's own vectors: today teacher.input-rhythm.get/put carry no `source`, after the
    // refresh from SRV #652 they do, and the same test then checks the level they name.
    for (const v of [...ok("teacher.input-rhythm.get"), ...ok("teacher.input-rhythm.put")]) {
      const body = v.response.body as { enabled: boolean; source?: string };
      const port = assignmentRhythmPort(apiAnswering(200, body).call, TASK);
      const answer = v.route.endsWith(".get") ? await port.read() : await port.set(body.enabled);
      expect({ name: `${v.route} ${v.name}`, answer })
        .toEqual({ name: `${v.route} ${v.name}`, answer: body.source === undefined ? { kind: "unavailable" } : expect.objectContaining({ kind: "ready" }) });
      if (body.source !== undefined) expect(answer).toMatchObject({ state: { source: body.source, enabled: body.enabled } });
    }
  });

  it("reads the level the refreshed contract (#524) lets the server name on GET and PUT", async () => {
    const by = { role: "teacher", name: null } as const;
    const own = { enabled: false, source: "assignment", changedBy: by, changedAt: "2026-11-23T09:00:00.000Z" };
    const followed = { enabled: false, source: "course", changedBy: by, changedAt: "2026-11-22T10:00:00.000Z" };
    expect(await assignmentRhythmPort(apiAnswering(200, own).call, TASK).read()).toMatchObject({ kind: "ready", state: { source: "assignment" } });
    expect(await assignmentRhythmPort(apiAnswering(200, followed).call, TASK).read()).toMatchObject({ kind: "ready", state: { source: "course", enabled: false } });
    expect(await assignmentRhythmPort(apiAnswering(200, { ...own, enabled: true }).call, TASK).set(true)).toMatchObject({ kind: "ready", state: { source: "assignment", enabled: true } });
    // A level outside the contract is not a level.
    expect(await assignmentRhythmPort(apiAnswering(200, { ...own, source: "faculty" }).call, TASK).read()).toEqual({ kind: "unavailable" });
  });

  it("negative control: a dated answer without a source is not read as the assignment's own setting", async () => {
    const dated = { enabled: false, changedBy: { role: "teacher", name: null }, changedAt: "2026-11-22T10:00:00.000Z" };
    expect(await assignmentRhythmPort(apiAnswering(200, dated).call, TASK).read()).toEqual({ kind: "unavailable" });
  });

  it("an assignment following a course with its own dated setting reads as the course's", async () => {
    const { call } = vectorApi("teacher.input-rhythm.delete", "course-holds");
    expect(await assignmentRhythmPort(call, TASK).reset!())
      .toMatchObject({ kind: "ready", state: { enabled: false, source: "course", changedAt: "2026-11-23T10:00:00.000Z" } });
  });

  it("going back to the course's setting is one DELETE and shows the level that now holds", async () => {
    const { call, fetchImpl } = vectorApi("teacher.input-rhythm.delete", "course-holds");
    await assignmentRhythmPort(call, TASK).reset!();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE_URL}/api/v1/teacher/assignments/${TASK}/input-rhythm`);
    expect(fetchImpl.mock.calls[0]![1]?.method).toBe("DELETE");
    expect(await assignmentRhythmPort(vectorApi("teacher.input-rhythm.delete", "default-holds").call, TASK).reset!())
      .toMatchObject({ kind: "ready", state: { enabled: true, source: "default" } });
  });

  it("401 is signedOut and 404 is unavailable on every assignment route", async () => {
    expect(await assignmentRhythmPort(vectorApi("teacher.input-rhythm.get", "unauthorized").call, TASK).read()).toEqual({ kind: "signedOut" });
    expect(await assignmentRhythmPort(vectorApi("teacher.input-rhythm.put", "unauthorized").call, TASK).set(false)).toEqual({ kind: "signedOut" });
    expect(await assignmentRhythmPort(vectorApi("teacher.input-rhythm.delete", "unauthorized").call, TASK).reset!()).toEqual({ kind: "signedOut" });
    expect(await assignmentRhythmPort(vectorApi("teacher.input-rhythm.get", "not-found").call, TASK).read()).toEqual({ kind: "unavailable" });
    expect(await assignmentRhythmPort(vectorApi("teacher.input-rhythm.delete", "not-found").call, TASK).reset!()).toEqual({ kind: "unavailable" });
  });
});
