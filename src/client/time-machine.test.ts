import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import { readTimeMachineComparison, readTimeMachineVersions, type CompareCall } from "./time-machine";

const baseUrl = "https://ductura.example.invalid";
const versionsBody = { versions: [
  { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z", afterDeadline: false },
  { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
], nextBeforeRevision: null };

describe("time machine client", () => {
  it("reads versions through the generated client only, and drops everything but kind, revision and minute", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(versionsBody));
    const read = await readTimeMachineVersions("izmišljeni rad/1", createApi({ baseUrl, fetchImpl }));
    expect(read).toEqual({ kind: "ready", partial: false, versions: [
      { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z" },
      { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
    ] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/works/${encodeURIComponent("izmišljeni rad/1")}/versions`);
    expect(init?.method).toBe("GET");
  });
  it("reports that older versions exist when the server gives a cursor", async () => {
    const body = { versions: [{ kind: "checkpoint", revision: 3, savedMinute: "2026-11-20T09:15:00.000Z" }], nextBeforeRevision: 3 };
    const read = await readTimeMachineVersions("d", createApi({ baseUrl, fetchImpl: async () => Response.json(body) }));
    expect(read).toEqual({ kind: "ready", partial: true, versions: [{ kind: "checkpoint", revision: 3, savedMinute: "2026-11-20T09:15:00.000Z" }] });
  });
  it("maps 401 to signedOut and other failures to unavailable", async () => {
    for (const [status, code, kind] of [[401, "unauthorized", "signedOut"], [503, "unavailable", "unavailable"]] as const) {
      const api = createApi({ baseUrl, fetchImpl: async () => Response.json({ code }, { status }) });
      await expect(readTimeMachineVersions("d", api)).resolves.toEqual({ kind });
    }
  });
  const ok = (body: unknown): CompareCall => async () => ({ ok: true, body });
  it("reads a closed comparison and rejects unknown shapes", async () => {
    const blocks = [{ op: "changed", words: [{ op: "removed", text: "a" }, { op: "added", text: "b" }] }];
    await expect(readTimeMachineComparison(ok({ blocks }), "d", 1, 2)).resolves.toEqual({ kind: "ready", blocks, truncated: false });
    await expect(readTimeMachineComparison(ok({ blocks, truncated: true }), "d", 1, 2)).resolves.toMatchObject({ truncated: true });
    await expect(readTimeMachineComparison(ok({ blocks: [{ op: "x", words: [] }] }), "d", 1, 2)).resolves.toEqual({ kind: "unavailable" });
    await expect(readTimeMachineComparison(ok({ blocks: [{ op: "same", words: [{ op: "same", text: 1 }] }] }), "d", 1, 2)).resolves.toEqual({ kind: "unavailable" });
  });
  it("sends older first and refuses a same or reversed pair without a call", async () => {
    const call = vi.fn(ok({ blocks: [] }));
    await readTimeMachineComparison(call, "d", 1, 3);
    expect(call.mock.calls[0]![1].query).toEqual({ from: "1", to: "3" });
    await expect(readTimeMachineComparison(call, "d", 3, 3)).resolves.toEqual({ kind: "unavailable" });
    await expect(readTimeMachineComparison(call, "d", 3, 1)).resolves.toEqual({ kind: "unavailable" });
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("maps 404 to notFound", async () => {
    await expect(readTimeMachineComparison(async () => ({ ok: false, status: 404 }), "d", 1, 2)).resolves.toEqual({ kind: "notFound" });
  });
});
