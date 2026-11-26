import { describe, expect, it, vi } from "vitest";

import { readEvents, WINDOW_MS } from "./read";
import { visibleEvents } from "./view";

const baseUrl = "https://ductura.example.invalid";
const now = new Date("2026-11-26T12:00:00.000Z");
const event = (seq: number, kind: string, over: object = {}) => ({ seq, at: "2026-11-26T11:00:00.000Z", kind, requestId: null, accountKind: null, fields: {}, ...over });

describe("događaji sustava", () => {
  it("traži prozor od 24 sata i stranicu nakon zadnjeg zapisa", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ events: [event(2, "job.failed")], next: null }));
    const result = await readEvents({ baseUrl, fetchImpl, now, after: 41 });
    expect(result).toEqual({ kind: "ready", data: { events: [event(2, "job.failed")], next: null } });
    const url = new URL(String((fetchImpl.mock.calls[0] as [URL])[0]));
    expect(url.pathname).toBe("/api/v1/ops/events");
    expect(url.searchParams.get("to")).toBe(now.toISOString());
    expect(url.searchParams.get("from")).toBe(new Date(now.getTime() - WINDOW_MS).toISOString());
    expect(url.searchParams.get("after")).toBe("41");
  });

  it.each([401, 403])("ne prikazuje događaje uz odgovor %s", async (status) => {
    await expect(readEvents({ baseUrl, now, fetchImpl: async () => Response.json({ events: [event(1, "a.b")], next: null }, { status }) })).resolves.toEqual({ kind: "denied" });
  });

  it("odbija odgovor s poljem izvan ugovora i prazan odgovor ne broji kao uspjeh", async () => {
    await expect(readEvents({ baseUrl, now, fetchImpl: async () => Response.json({ events: [event(1, "a.b", { user: "demo" })], next: null }) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readEvents({ baseUrl, now, fetchImpl: async () => new Response(null, { status: 200 }) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readEvents({ baseUrl, now, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });

  it("filtrira po početku vrste i sortira od najnovijeg", () => {
    const events = [event(1, "restore.done"), event(3, "job.failed"), event(2, "job.done")];
    expect(visibleEvents(events, " JOB ").map((e) => e.seq)).toEqual([3, 2]);
    expect(visibleEvents(events, "").map((e) => e.seq)).toEqual([3, 2, 1]);
    expect(visibleEvents(events, "xyz")).toEqual([]);
  });
});
