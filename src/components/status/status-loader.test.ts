import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";
import { parsePublicStatus } from "@/lib/status/public-status";

import { contractStatusRequest, onWake, REQUEST_TIMEOUT_MS, statusLoader } from "./status-loader";

const body = { checkedAt: "2026-11-12T10:25:00.000Z", components: { writing: "radi", submission: "radi", mentorView: "radi" } };

function events() {
  return { ok: vi.fn(), fail: vi.fn(), settled: vi.fn() };
}

/** A request that waits until the test answers it, or rejects when its signal aborts, as fetch does. */
function pending() {
  let answer: (r: Response) => void = () => {};
  const request = vi.fn(
    (signal: AbortSignal) =>
      new Promise<Response>((resolve, reject) => {
        answer = resolve;
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  return { request, answer: (r: Response) => answer(r) };
}

// DAN-429, pre-review of #1975: the board on a remount (StrictMode in dev, Fast Refresh).
describe("statusLoader", () => {
  it("lets a remount ask at once and keeps the aborted request of the first mount silent", async () => {
    const first = new AbortController();
    const firstEvents = events();
    const firstReq = pending();
    const firstLoad = statusLoader(first.signal, firstEvents, firstReq.request);
    const firstRun = firstLoad();

    first.abort();
    const second = new AbortController();
    const secondEvents = events();
    const secondReq = pending();
    const secondRun = statusLoader(second.signal, secondEvents, secondReq.request)();

    await firstRun;
    expect(firstEvents.fail).not.toHaveBeenCalled();
    expect(firstEvents.settled).not.toHaveBeenCalled();
    expect(secondReq.request).toHaveBeenCalledTimes(1);

    secondReq.answer(Response.json(body));
    await secondRun;
    expect(secondEvents.ok).toHaveBeenCalledWith(body);
    expect(secondEvents.fail).not.toHaveBeenCalled();
  });

  it("runs one request at a time and asks again once it settled", async () => {
    const e = events();
    const req = pending();
    const load = statusLoader(new AbortController().signal, e, req.request);
    const run = load();
    await load();
    expect(req.request).toHaveBeenCalledTimes(1);
    req.answer(Response.json(body));
    await run;
    void load();
    expect(req.request).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a 503", () => Promise.resolve(new Response(null, { status: 503 }))],
    ["a body outside the closed shape", () => Promise.resolve(Response.json({ ...body, host: "db" }))],
    ["a network failure", () => Promise.reject(new TypeError("failed"))],
  ])("reports %s as a failure", async (_, request) => {
    const e = events();
    await statusLoader(new AbortController().signal, e, request)();
    expect(e.fail).toHaveBeenCalledTimes(1);
    expect(e.ok).not.toHaveBeenCalled();
    expect(e.settled).toHaveBeenCalledTimes(1);
  });

  it("asks nothing once its mount is gone", async () => {
    const c = new AbortController();
    c.abort();
    const request = vi.fn();
    await statusLoader(c.signal, events(), request)();
    expect(request).not.toHaveBeenCalled();
  });

  // Pre-QA of #1975: a request that never answers must not freeze polling and retry.
  it("gives up on a request that hangs, reports a failure and asks again", async () => {
    vi.useFakeTimers();
    try {
      const e = events();
      const req = pending();
      const load = statusLoader(new AbortController().signal, e, req.request);
      const run = load();
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      await run;
      expect(e.fail).toHaveBeenCalledTimes(1);
      expect(e.settled).toHaveBeenCalledTimes(1);
      void load();
      expect(req.request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Pre-QA of #1979: after sleep the poll timer was paused, so the board must ask on waking.
describe("onWake", () => {
  const setup = () => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: "hidden" });
    const wake = vi.fn();
    const stop = onWake(win, doc, wake);
    return { win, doc, wake, stop };
  };

  it("wakes on pageshow, online and becoming visible, not on becoming hidden", () => {
    const { win, doc, wake } = setup();
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(wake).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("pageshow"));
    win.dispatchEvent(new Event("online"));
    expect(wake).toHaveBeenCalledTimes(3);
  });

  it("stops listening once stopped", () => {
    const { win, doc, wake, stop } = setup();
    stop();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("pageshow"));
    win.dispatchEvent(new Event("online"));
    expect(wake).not.toHaveBeenCalled();
  });
});

describe("contractStatusRequest (WEB-13, platform.status.get on /api/v1)", () => {
  type Api = NonNullable<Parameters<typeof contractStatusRequest>[0]>;
  const BODY = { checkedAt: "2026-11-19T10:00:00.000Z", components: { writing: "radi", submission: "ne_radi", mentorView: "nije_ukljuceno" } };
  const api = (result: unknown) => (async () => result) as unknown as Api;

  it("gives a checked answer back as a 200 the loader parses", async () => {
    const response = await contractStatusRequest(api({ ok: true, status: 200, body: BODY }))(new AbortController().signal);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(BODY);
  });

  it("gives a failure its status, and a client refusal 502", async () => {
    expect((await contractStatusRequest(api({ ok: false, status: 503, code: "unavailable" }))(new AbortController().signal)).ok).toBe(false);
    expect((await contractStatusRequest(api({ ok: false, status: 0, code: "client_rejected" }))(new AbortController().signal)).status).toBe(502);
  });

  it("rejects on abort without waiting for the answer", async () => {
    const controller = new AbortController();
    const pending = contractStatusRequest((() => new Promise(() => {})) as unknown as Api)(controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it("starts no second call while one is still out, and a new one once it answered", async () => {
    let calls = 0;
    let answer: (value: unknown) => void = () => {};
    const request = contractStatusRequest((() => {
      calls += 1;
      return new Promise((done) => (answer = done));
    }) as unknown as Api);
    const first = new AbortController();
    const hung = request(first.signal);
    first.abort();
    await expect(hung).rejects.toThrow();
    const second = request(new AbortController().signal);
    expect(calls).toBe(1);
    answer({ ok: true, status: 200, body: BODY });
    expect((await second).status).toBe(200);
    const third = new AbortController();
    const again = request(third.signal);
    expect(calls).toBe(2);
    third.abort();
    await expect(again).rejects.toThrow();
  });
});

// LOK-WEB-7: the answer the server's /api/v1/status really sends, through the real createApi.
describe("platform.status.get through createApi", () => {
  const SERVER_BODY = {
    checkedAt: "2026-11-22T13:00:24.495Z",
    components: { writing: "radi", submission: "radi", mentorView: "radi" },
    maintenanceWindows: [{ startsAt: "2026-11-23T22:00:00.000Z", endsAt: "2026-11-23T23:00:00.000Z" }],
  };
  const serving = (body: unknown) => createApi({
    baseUrl: "https://ductura.example.invalid",
    fetchImpl: async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
  });

  it("reads maintenanceWindows and the page parses the answer", async () => {
    const response = await contractStatusRequest(serving(SERVER_BODY))(new AbortController().signal);
    expect(response.status).toBe(200);
    expect(parsePublicStatus(await response.json())).toEqual(SERVER_BODY);
  });

  const read = (body: unknown) => serving(body)("platform.status.get", { params: undefined, query: undefined, body: undefined });

  it("still refuses a field the server does not declare", async () => {
    expect(await read({ ...SERVER_BODY, note: "x" })).toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("refuses a window time without milliseconds", async () => {
    const windows = [{ startsAt: "2026-11-23T22:00:00Z", endsAt: "2026-11-23T23:00:00.000Z" }];
    expect(await read({ ...SERVER_BODY, maintenanceWindows: windows })).toEqual({ ok: false, status: 200, code: "unexpected" });
  });
});
