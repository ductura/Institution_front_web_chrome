import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import { createEventDisputes, createFakeEventDisputes, disputeLength, isValidDisputeText, MAX_DISPUTE_LENGTH, type EventDispute } from "./event-disputes";

const row: EventDispute = { id: "00000000-0000-4000-8000-0000000000aa", eventId: "e1", kind: "supplement", text: "Izmišljena dopuna.", createdWindow: "2026-11-20T10:00:00.000Z" };

describe("event disputes port (fake)", () => {
  it("counts code points and enforces the 1000 limit", () => {
    expect(disputeLength("😀a")).toBe(2);
    expect(isValidDisputeText("a".repeat(MAX_DISPUTE_LENGTH))).toBe(true);
    expect(isValidDisputeText("a".repeat(MAX_DISPUTE_LENGTH + 1))).toBe(false);
    expect(isValidDisputeText("   ")).toBe(false);
  });

  it("lists nothing for an unknown work and the invented rows for a known one", async () => {
    const port = createFakeEventDisputes({ d1: [row] });
    expect(await port.list("d2")).toEqual({ kind: "ok", disputes: [] });
    expect(await port.list("d1")).toEqual({ kind: "ok", disputes: [row] });
  });

  it("a send is stored and then listed; the description of the event is not part of it", async () => {
    const port = createFakeEventDisputes();
    const out = await port.send("d1", { eventId: "e1", kind: "dispute", text: "Ovo osporavam." });
    expect(out.kind).toBe("ok");
    const list = await port.list("d1");
    expect(list.kind === "ok" && list.disputes.map((d) => [d.eventId, d.kind, d.text])).toEqual([["e1", "dispute", "Ovo osporavam."]]);
  });

  it("answers invalid (422) for a text the route would refuse", async () => {
    expect(await createFakeEventDisputes().send("d1", { eventId: "e1", kind: "dispute", text: "x".repeat(1001) })).toEqual({ kind: "invalid" });
  });

  it("answers forbidden (403) for every call when set to", async () => {
    const port = createFakeEventDisputes({}, { fail: "forbidden" });
    expect(await port.list("d1")).toEqual({ kind: "forbidden" });
    expect(await port.send("d1", { eventId: "e1", kind: "dispute", text: "tekst" })).toEqual({ kind: "forbidden" });
  });
});

// Every id, text and date below is invented.
const BASE_URL = "https://ductura.example.invalid";
const D1 = "00000000-0000-4000-8000-0000000000d1";
const ERROR = (code: string, status: number) => ({ error: code, code, messageKey: "errors.x", status, requestId: D1 });

function answering(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { port: createEventDisputes(createApi({ baseUrl: BASE_URL, fetchImpl })), fetchImpl };
}

describe("event disputes port over createApi (work.event-disputes.*)", () => {
  it("reads every mark of a work with one GET and keeps the screen's words", async () => {
    const { port, fetchImpl } = answering(200, { disputes: [
      { disputeId: D1, kind: "amendment", eventId: "sessions/1", text: "Izmišljena dopuna.", createdAt: "2026-11-21T09:15:00.123Z" },
      { disputeId: "00000000-0000-4000-8000-0000000000d2", kind: "dispute", eventId: "pastes/0", text: "Izmišljeno osporavanje.", createdAt: "2026-11-21T09:16:00.000Z" },
    ] });
    expect(await port.list("izmisljeni-rad-0001")).toEqual({ kind: "ok", disputes: [
      { id: D1, eventId: "sessions/1", kind: "supplement", text: "Izmišljena dopuna.", createdWindow: "2026-11-21T09:15:00.123Z" },
      { id: "00000000-0000-4000-8000-0000000000d2", eventId: "pastes/0", kind: "dispute", text: "Izmišljeno osporavanje.", createdWindow: "2026-11-21T09:16:00.000Z" },
    ] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/works/izmisljeni-rad-0001/event-disputes`);
    expect(init?.method).toBe("GET");
  });

  it("a read the contract does not allow is not shown", async () => {
    const { port } = answering(200, { disputes: [{ disputeId: D1, kind: "supplement", eventId: "e1", text: "x", createdAt: "2026-11-21T09:15:00.123Z" }] });
    expect(await port.list("izmisljeni-rad-0001")).toEqual({ kind: "unavailable" });
  });

  it("maps a failed read: 401 signed out, 404 forbidden, 503 unavailable", async () => {
    expect(await answering(401, ERROR("unauthorized", 401)).port.list("r")).toEqual({ kind: "signedOut" });
    expect(await answering(404, ERROR("not_found", 404)).port.list("r")).toEqual({ kind: "forbidden" });
    expect(await answering(503, ERROR("unavailable", 503)).port.list("r")).toEqual({ kind: "unavailable" });
  });

  it("a mark is ok only with the server's 201, and carries the server's id and time", async () => {
    const { port, fetchImpl } = answering(201, { disputeId: D1, createdAt: "2026-11-21T09:15:00.123Z" });
    expect(await port.send("izmisljeni-rad-0001", { eventId: "pastes/0", kind: "supplement", text: "Iz mojih bilješki." }))
      .toEqual({ kind: "ok", dispute: { id: D1, eventId: "pastes/0", kind: "supplement", text: "Iz mojih bilješki.", createdWindow: "2026-11-21T09:15:00.123Z" } });
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ eventId: "pastes/0", kind: "amendment", text: "Iz mojih bilješki." });
  });

  it("a 201 without the contract's fields confirms nothing", async () => {
    expect(await answering(201, { disputeId: D1 }).port.send("r", { eventId: "pastes/0", kind: "dispute", text: "tekst" }))
      .toEqual({ kind: "unavailable" });
  });

  it("maps refusals of a send", async () => {
    const send = (status: number, code: string) => answering(status, ERROR(code, status)).port.send("r", { eventId: "pastes/0", kind: "dispute", text: "tekst" });
    expect(await send(401, "unauthorized")).toEqual({ kind: "signedOut" });
    expect(await send(403, "forbidden")).toEqual({ kind: "forbidden" });
    expect(await send(422, "invalid_input")).toEqual({ kind: "invalid" });
    expect(await send(503, "unavailable")).toEqual({ kind: "unavailable" });
  });

  it("a text over MAX_DISPUTE_LENGTH or blank never leaves the browser", async () => {
    const { port, fetchImpl } = answering(201, { disputeId: D1, createdAt: "2026-11-21T09:15:00.123Z" });
    expect(await port.send("r", { eventId: "pastes/0", kind: "dispute", text: "x".repeat(MAX_DISPUTE_LENGTH + 1) })).toEqual({ kind: "invalid" });
    expect(await port.send("r", { eventId: "pastes/0", kind: "dispute", text: "  " })).toEqual({ kind: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a broken connection is unavailable", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("offline"); });
    const port = createEventDisputes(createApi({ baseUrl: BASE_URL, fetchImpl }));
    expect(await port.list("r")).toEqual({ kind: "unavailable" });
    expect(await port.send("r", { eventId: "pastes/0", kind: "dispute", text: "tekst" })).toEqual({ kind: "unavailable" });
  });
});
