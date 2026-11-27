import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { createRecordedPort } from "./recorded-overview";

// The server's own answers come from the contract vectors; every id, name and date in them is invented.
const BASE_URL = "https://ductura.example.invalid";
const WORK = "rad-izmisljen-1";
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

describe("transfers into the work", () => {
  it("reads the three transfer kinds from the composition and leaves the others out", async () => {
    const { call, fetchImpl } = vectorApi("work.origin-composition.get", "composed");
    const answer = await createRecordedPort(call).transfers(WORK);
    expect(answer.kind).toBe("ready");
    if (answer.kind !== "ready") return;
    expect(answer.value.map((p) => p.kind)).toEqual(["imported_file", "pasted_known", "pasted_unknown"]);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(`/works/${WORK}/origin-composition`);
    expect((fetchImpl.mock.calls[0]![1]?.method ?? "GET").toUpperCase()).toBe("GET");
  });

  it("says a work with nothing recorded as zero, not as unavailable", async () => {
    const answer = await createRecordedPort(vectorApi("work.origin-composition.get", "nothing-recorded").call).transfers(WORK);
    expect(answer).toMatchObject({ kind: "ready" });
  });

  it("maps 401 to signedOut and every other refusal (404, 503) to the same unavailable", async () => {
    expect(await createRecordedPort(vectorApi("work.origin-composition.get", "unauthorized").call).transfers(WORK)).toEqual({ kind: "signedOut" });
    expect(await createRecordedPort(vectorApi("work.origin-composition.get", "not-found").call).transfers(WORK)).toEqual({ kind: "unavailable" });
    expect(await createRecordedPort(vectorApi("work.origin-composition.get", "unavailable").call).transfers(WORK)).toEqual({ kind: "unavailable" });
  });

  it("is unavailable when the call throws or the answer lacks a transfer kind", async () => {
    const thrown = (async () => { throw new Error("offline"); }) as unknown as ReturnType<typeof createApi>;
    expect(await createRecordedPort(thrown).transfers(WORK)).toEqual({ kind: "unavailable" });
    const odd = apiAnswering(200, { parts: [{ kind: "typed", percent: 100 }] });
    expect(await createRecordedPort(odd.call).transfers(WORK)).toEqual({ kind: "unavailable" });
  });
});

describe("conversations with the assistant", () => {
  it("sums conversations and requests and names the last activity", async () => {
    const answer = await createRecordedPort(vectorApi("student.assistant-conversations.get", "two-conversations").call).conversations(TASK);
    expect(answer.kind).toBe("ready");
    if (answer.kind !== "ready") return;
    expect(answer.value.conversations).toBe(2);
    expect(answer.value.requests).toBeGreaterThanOrEqual(2);
    expect(answer.value.lastActivityAt).not.toBeNull();
  });

  it("says no conversation as zero, and 401, 403, 404 and 503 as the right kind of failure", async () => {
    expect(await createRecordedPort(vectorApi("student.assistant-conversations.get", "none-yet").call).conversations(TASK))
      .toEqual({ kind: "ready", value: { conversations: 0, requests: 0, lastActivityAt: null } });
    expect(await createRecordedPort(vectorApi("student.assistant-conversations.get", "unauthorized").call).conversations(TASK)).toEqual({ kind: "signedOut" });
    for (const name of ["cross-site", "not-found-or-not-enrolled", "unavailable"]) {
      expect(await createRecordedPort(vectorApi("student.assistant-conversations.get", name).call).conversations(TASK)).toEqual({ kind: "unavailable" });
    }
  });
});
