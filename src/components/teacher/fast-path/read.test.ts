import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_FAST_PATH } from "@/lib/i18n/demo-fast-path.hr";

import { FAST_PATH_REFRESH_MS, readFastPath, readRevisionPreview, startFastPathReader } from "./read";

const baseUrl = "https://ductura.example.invalid";
const assignmentId = "3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01";
const started = { ...DEMO_FAST_PATH[0]!, id: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01" };
const pending = { ...DEMO_FAST_PATH[2]!, id: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02" };

function answer(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("assignment read", () => {
  it("posts the assignment alone and accepts the roster with and without a record", async () => {
    const students = [pending, started];
    const fetchImpl = answer({ kind: "ok", students });
    expect(await readFastPath(assignmentId, { baseUrl, fetchImpl })).toEqual({ kind: "ok", students });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/teacher/fast-path`);
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ assignmentId }) });
  });

  it("keeps empty distinct from unauthorized and rejects unknown data", async () => {
    const empty = answer({ kind: "ok", students: [] });
    const denied = answer({ error: "unauthorized" }, 401);
    const unexpected = answer({ kind: "ok", students: [{ ...started, privateNotes: ["Radna bilješka"] }] });
    expect(await readFastPath(assignmentId, { baseUrl, fetchImpl: empty })).toEqual({ kind: "ok", students: [] });
    expect(await readFastPath(assignmentId, { baseUrl, fetchImpl: denied })).toEqual({ kind: "signedOut" });
    expect(await readFastPath(assignmentId, { baseUrl, fetchImpl: unexpected })).toEqual({ kind: "unavailable" });
  });
});

describe("revision preview", () => {
  const at = "2026-11-18T09:30:00.000Z";
  const row = {
    request_id: "aaaaaaaa-0000-4000-8000-000000000001", request_state: "responded", request_version: 2,
    request_row_seq: 8, version: 2, anchor: null, instruction: "Dopuni izmišljeni rad.", requested_revision: 8,
    opened_is_own: true, opened_window: at, response_kind: "done", response_explanation: "Dodan izvor.",
    response_is_own: false, response_revision: 9, response_window: at, closed_as: null, closed_is_own: null,
    closed_window: null, accepted_revision: null, accepted_range_hash: null,
  };
  const first = {
    ...row, version: 1, requested_revision: 4, response_revision: 5, opened_window: "2026-11-17T09:00:00.000Z",
    response_window: "2026-11-17T09:15:00.000Z", closed_as: "reopened", closed_is_own: true, closed_window: at,
    anchor: { nodeId: "0f8e2a64-1b3c-4d5e-8f60-718293a4b5c6", quote: "knjižnice", prefix: "", suffix: "", startHint: 0, endHint: 9 },
  };

  it.each([["done", true], ["declined", false]])("shows the second round and flags completion only for %s", async (kind, awaiting) => {
    const fetchImpl = answer({ requests: [first, { ...row, response_kind: kind }] });
    const result = await readRevisionPreview("demo-document-3", () => true, { baseUrl, fetchImpl });
    if (result.kind !== "ok") throw new Error(`Unexpected revision result: ${result.kind}`);
    expect(result.awaiting).toBe(awaiting);
    expect(result.entries.map(({ round, kind }) => [round, kind])).toEqual([
      [1, "opened"], [1, "responded"], [2, "reopened"], [2, awaiting ? "responded" : "declined"],
    ]);
    expect(JSON.stringify(result)).not.toContain(row.response_explanation);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/revision-requests/list`);
    expect(init?.body).toBe(JSON.stringify({ documentId: "demo-document-3" }));
  });

  it("makes no revision read for an ended session", async () => {
    const fetchImpl = answer({ requests: [] });
    expect(await readRevisionPreview("demo-document-3", () => false, { baseUrl, fetchImpl })).toEqual({ kind: "signedOut" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("refresh", () => {
  afterEach(() => vi.useRealTimers());

  it("runs only when visible, retains a stale result, then clears it on sign-out", async () => {
    vi.useFakeTimers();
    const visibility = Object.assign(new EventTarget(), { visibilityState: "hidden" as DocumentVisibilityState });
    const read = vi.fn<typeof readFastPath>()
      .mockResolvedValueOnce({ kind: "ok", students: [started] })
      .mockResolvedValueOnce({ kind: "unavailable" })
      .mockResolvedValueOnce({ kind: "signedOut" });
    const onChange = vi.fn();
    const stop = startFastPathReader({ assignmentId, current: () => true, onChange, read, visibility });
    await vi.advanceTimersByTimeAsync(FAST_PATH_REFRESH_MS);
    expect(read).not.toHaveBeenCalled();
    visibility.visibilityState = "visible";
    visibility.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenLastCalledWith({ state: "ready", students: [started], stale: false });
    await vi.advanceTimersByTimeAsync(FAST_PATH_REFRESH_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange).toHaveBeenLastCalledWith({ state: "ready", students: [started], stale: true });
    await vi.advanceTimersByTimeAsync(2 * FAST_PATH_REFRESH_MS);
    expect(onChange).toHaveBeenLastCalledWith({ state: "signedOut" });
    expect(read).toHaveBeenCalledTimes(3);
    stop();
  });
});
