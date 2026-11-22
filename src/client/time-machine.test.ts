import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import { readTimeMachineComparison, readTimeMachineVersions } from "./time-machine";

const baseUrl = "https://ductura.example.invalid";
const versionsBody = { versions: [
  { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z", afterDeadline: false },
  { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
], nextBeforeRevision: null };

describe("time machine client", () => {
  it("reads versions through the generated client only, and drops everything but kind, revision and minute", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(versionsBody));
    const read = await readTimeMachineVersions("izmišljeni rad/1", createApi({ baseUrl, fetchImpl }));
    expect(read).toEqual({ kind: "ready", versions: [
      { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z" },
      { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
    ] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/works/${encodeURIComponent("izmišljeni rad/1")}/versions`);
    expect(init?.method).toBe("GET");
  });
  it("maps 401 to signedOut and other failures to unavailable", async () => {
    for (const [status, code, kind] of [[401, "unauthorized", "signedOut"], [503, "unavailable", "unavailable"]] as const) {
      const api = createApi({ baseUrl, fetchImpl: async () => Response.json({ code }, { status }) });
      await expect(readTimeMachineVersions("d", api)).resolves.toEqual({ kind });
    }
  });
  const answering = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => Response.json(body, { status }));
  it("reads a comparison through the generated client and keeps only the blocks", async () => {
    const blocks = [
      { kind: "heading", level: 2, change: "unchanged", text: "Uvod" },
      { kind: "paragraph", change: "removed", text: "stara rečenica" },
      { kind: "paragraph", change: "added", text: "nova rečenica" },
    ];
    const fetchImpl = answering({ from: 1, to: 2, blocks });
    await expect(readTimeMachineComparison("izmišljeni rad/1", 1, 2, createApi({ baseUrl, fetchImpl }))).resolves.toEqual({ kind: "ready", blocks });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/works/${encodeURIComponent("izmišljeni rad/1")}/compare?from=1&to=2`);
    expect(init?.method).toBe("GET");
  });
  it("sends older first and refuses a same or reversed pair without a call", async () => {
    const fetchImpl = answering({ from: 1, to: 3, blocks: [] });
    const api = createApi({ baseUrl, fetchImpl });
    await readTimeMachineComparison("d", 1, 3, api);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("from=1&to=3");
    await expect(readTimeMachineComparison("d", 3, 3, api)).resolves.toEqual({ kind: "unavailable" });
    await expect(readTimeMachineComparison("d", 3, 1, api)).resolves.toEqual({ kind: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("maps 401 to signedOut, 404 to notFound and the rest to unavailable", async () => {
    for (const [status, code, kind] of [[401, "unauthorized", "signedOut"], [404, "not_found", "notFound"], [503, "unavailable", "unavailable"]] as const) {
      const api = createApi({ baseUrl, fetchImpl: answering({ code }, status) });
      await expect(readTimeMachineComparison("d", 1, 2, api)).resolves.toEqual({ kind });
    }
  });
});
