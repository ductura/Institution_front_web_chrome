import { afterEach, describe, expect, it, vi } from "vitest";

import { LIVE_PORT } from "../../editor/work/review/review-model";
import type { RevisionRequest } from "@/client/revision-requests";
import { revisionPort } from "./port";

const answer = (status: number, body: object = {}) => ({ ok: status === 200, status, body });
const DOC = "doc-1";
const BODY = { instruction: "Dopuni uvod.", dueAt: "2026-12-01T22:59:00.000Z" };

const fetchWith = (status: number, body: object) => vi.stubGlobal("fetch", vi.fn(async () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
afterEach(() => vi.unstubAllGlobals());

describe("the live ports carry the whole-work return", () => {
  it("has a return on the review port and on the revision port", () => {
    expect(LIVE_PORT.returnForRevision).not.toBeNull();
    expect(typeof revisionPort.create).toBe("function");
  });
  it("answers unavailable, not ok, when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await revisionPort.create(DOC, BODY)).toBe("unavailable");
    expect(await LIVE_PORT.returnForRevision!({ action: "return", documentId: DOC, instruction: BODY.instruction, dueAt: BODY.dueAt })).toBeNull();
  });
  it("ignores a stub that answers nothing known", async () => {
    fetchWith(500, answer(500));
    expect(await revisionPort.create(DOC, BODY)).toBe("unavailable");
  });
});

// #594 review, point 1: "Povuci zahtjev" sends the contract's withdraw with only the request and its counter.
describe("withdraw on the revision port", () => {
  const REQUEST_ID = "8b7a6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c01";
  const request = { id: REQUEST_ID, number: 1, state: "open", rowSeq: 4, anchor: null, versions: [] } as unknown as RevisionRequest;
  const applied = { outcome: "applied", row_seq: 5, version: 1, state: "withdrawn" };
  const calls: { url: string; method: string | undefined; body: unknown }[] = [];
  function answerWith(status: number, body: object) {
    calls.length = 0;
    vi.stubGlobal("location", { origin: "https://ductura.example.invalid" });
    vi.stubGlobal("fetch", vi.fn(async (url: URL | string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }));
  }

  it("posts the withdraw action with exactly {requestId, expectedSeq}", async () => {
    answerWith(200, applied);
    expect(await revisionPort.withdraw(request)).toBe("ok");
    expect(calls).toEqual([{
      url: "https://ductura.example.invalid/api/v1/revision-requests/withdraw", method: "POST",
      body: { requestId: REQUEST_ID, expectedSeq: 4 },
    }]);
  });

  it("names each refusal and never says ok for it", async () => {
    const cases: [number, object, string][] = [
      [409, { row_seq: 6, version: 1, state: "responded", outcome: "conflict" }, "conflict"],
      [403, { error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status: 403, requestId: REQUEST_ID }, "forbidden"],
      [401, { error: "unauthorized", code: "unauthorized", messageKey: "errors.unauthorized", status: 401, requestId: REQUEST_ID }, "signedOut"],
      [503, { error: "unavailable", code: "unavailable", messageKey: "errors.unavailable", status: 503, requestId: REQUEST_ID }, "unavailable"],
    ];
    for (const [status, body, outcome] of cases) {
      answerWith(status, body);
      expect(await revisionPort.withdraw(request)).toBe(outcome);
      expect(calls.map((c) => c.body)).toEqual([{ requestId: REQUEST_ID, expectedSeq: 4 }]);
    }
  });

  it("is unavailable when the server cannot be reached or answers outside the contract", async () => {
    answerWith(200, { requests: "nije popis" });
    expect(await revisionPort.withdraw(request)).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await revisionPort.withdraw(request)).toBe("unavailable");
  });
});
