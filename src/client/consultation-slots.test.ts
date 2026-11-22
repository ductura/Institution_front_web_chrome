// WEB-1108 / WEB-2001: consultation slots through createApi over invented answers. All data is invented.
import { createApi } from "./api";
import { describe, expect, it } from "vitest";
import {
  readConsultationSlots, requestConsultationSlot, updateConsultationSlot, validStartsAt, type SlotsApi,
} from "./consultation-slots";

const DOC = "1a2b3c4d-5e6f-4a01-9c3d-4e5f6a7b8c9d";
const SLOT = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c9d";
const OTHER = "3e9c4f5b-7d80-4b12-8d4e-5f6a7b8c9d0e";
const T1 = "2026-11-21T12:00:00.000Z";
const T2 = "2026-11-24T13:30:00.000Z";
const slot = { id: SLOT, startsAt: T1, proposedAt: "2026-11-20T11:11:00.000Z", state: "requested" };
const BASE = "https://ductura.example.invalid";
const ERRORS: Record<number, string> = { 401: "unauthorized", 404: "not_found", 409: "conflict", 422: "invalid_input", 403: "forbidden" };
type Call = [method: string, path: string, body: unknown];

function answer(status: number, body: unknown, calls: Call[] = []): SlotsApi {
  return createApi({
    baseUrl: BASE,
    fetchImpl: async (input, init) => {
      calls.push([init?.method ?? "GET", new URL(String(input)).pathname, init?.body ? JSON.parse(String(init.body)) : undefined]);
      const json = status < 400 ? body : { code: ERRORS[status] ?? "unavailable" };
      return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
    },
  });
}
const nepoznato = { kind: "nepoznato" };
const broken: SlotsApi = createApi({ baseUrl: BASE, fetchImpl:  () => Promise.reject(new TypeError("Failed to fetch")) });

describe("readConsultationSlots", () => {
  it("one GET without a body; the list as given, an empty one is empty", async () => {
    const calls: Call[] = [];
    expect(await readConsultationSlots(answer(200, { slots: [slot] }, calls), DOC)).toEqual({ kind: "ready", slots: [slot] });
    expect(calls).toEqual([["GET", `/api/v1/works/${DOC}/consultation-slots`, undefined]]);
    expect(await readConsultationSlots(answer(200, { slots: [] }), DOC)).toEqual({ kind: "ready", slots: [] });
  });
  it.each([
    ["an unknown field on the list", { slots: [], more: 1 }],
    ["an unknown field on a slot", { slots: [{ ...slot, room: "A" }] }],
    ["an unknown status", { slots: [{ ...slot, state: "done" }] }],
    ["a time that is not a date", { slots: [{ ...slot, startsAt: "sutra" }] }],
    ["the same slot twice", { slots: [slot, slot] }],
  ])("%s is nepoznato", async (_n, body) => {
    expect(await readConsultationSlots(answer(200, body), DOC)).toEqual(nepoznato);
  });
  it("401 ends the session, 404 is not found, the rest and a broken connection are nepoznato", async () => {
    expect(await readConsultationSlots(answer(401, null), DOC)).toEqual({ kind: "session-expired" });
    expect(await readConsultationSlots(answer(404, null), DOC)).toEqual({ kind: "greska", code: "not_found" });
    for (const s of [403, 408, 503]) expect(await readConsultationSlots(answer(s, null), DOC)).toEqual(nepoznato);
    expect(await readConsultationSlots(broken, DOC)).toEqual(nepoznato);
  });
});

describe("requestConsultationSlot", () => {
  it("POSTs {startsAt}; saved only from a 201 requested slot with that time", async () => {
    const calls: Call[] = [];
    expect(await requestConsultationSlot(answer(201, slot, calls), DOC, T1)).toEqual({ kind: "saved", slot });
    expect(calls).toEqual([["POST", `/api/v1/works/${DOC}/consultation-slots`, { startsAt: T1 }]]);
  });
  it("a wrong status code, another time or another status is nepoznato", async () => {
    expect(await requestConsultationSlot(answer(200, slot), DOC, T1)).toEqual(nepoznato);
    expect(await requestConsultationSlot(answer(201, { ...slot, startsAt: T2 }), DOC, T1)).toEqual(nepoznato);
    expect(await requestConsultationSlot(answer(201, { ...slot, state: "confirmed" }), DOC, T1)).toEqual(nepoznato);
  });
  it("a bad time is not sent", async () => {
    const calls: Call[] = [];
    expect(await requestConsultationSlot(answer(201, slot, calls), DOC, "sutra u 12")).toEqual({ kind: "greska", code: "invalid" });
    expect(calls).toEqual([]);
  });
  it("network and server failures keep it unknown; 401, 404, 409, 422 are told apart", async () => {
    expect(await requestConsultationSlot(broken, DOC, T1)).toEqual(nepoznato);
    for (const s of [408, 500, 503]) expect(await requestConsultationSlot(answer(s, null), DOC, T1)).toEqual(nepoznato);
    expect(await requestConsultationSlot(answer(401, null), DOC, T1)).toEqual({ kind: "session-expired" });
    expect(await requestConsultationSlot(answer(404, null), DOC, T1)).toEqual({ kind: "greska", code: "not_found" });
    expect(await requestConsultationSlot(answer(409, null), DOC, T1)).toEqual({ kind: "promijenjeno" });
    expect(await requestConsultationSlot(answer(422, null), DOC, T1)).toEqual({ kind: "greska", code: "invalid" });
  });
});

describe("updateConsultationSlot", () => {
  it("confirm sends only the action; saved from a confirmed slot of the same id", async () => {
    const calls: Call[] = [];
    const confirmed = { ...slot, state: "confirmed" };
    expect(await updateConsultationSlot(answer(200, confirmed, calls), DOC, SLOT, "confirm")).toEqual({ kind: "saved", slot: confirmed });
    expect(calls).toEqual([["PATCH", `/api/v1/works/${DOC}/consultation-slots/${SLOT}`, { action: "confirm" }]]);
  });
  it("counter sends the new time and needs a countered slot with that time", async () => {
    const calls: Call[] = [];
    const proposed = { ...slot, startsAt: T2, state: "countered" };
    expect(await updateConsultationSlot(answer(200, proposed, calls), DOC, SLOT, "counter", T2)).toEqual({ kind: "saved", slot: proposed });
    expect(calls[0]![2]).toEqual({ action: "counter", startsAt: T2 });
    expect(await updateConsultationSlot(answer(200, { ...proposed, startsAt: T1 }), DOC, SLOT, "counter", T2)).toEqual(nepoznato);
  });
  it("accept leads to the same confirmed slot", async () => {
    const confirmed = { ...slot, startsAt: T2, state: "confirmed" };
    expect(await updateConsultationSlot(answer(200, confirmed), DOC, SLOT, "accept")).toEqual({ kind: "saved", slot: confirmed });
  });
  it("an answer for another slot or another status is nepoznato", async () => {
    expect(await updateConsultationSlot(answer(200, { ...slot, id: OTHER, state: "confirmed" }), DOC, SLOT, "confirm")).toEqual(nepoznato);
    expect(await updateConsultationSlot(answer(200, slot), DOC, SLOT, "confirm")).toEqual(nepoznato);
  });
  it("is not sent without a valid id, with a time on confirm, or without one on propose", async () => {
    const calls: Call[] = [];
    const ok = answer(200, slot, calls);
    for (const args of [["bad", "confirm"], [SLOT, "confirm", T1], [SLOT, "counter"], [SLOT, "counter", "sutra"]] as const) {
      expect(await updateConsultationSlot(ok, DOC, args[0], args[1], args[2])).toEqual({ kind: "greska", code: "invalid" });
    }
    expect(calls).toEqual([]);
  });
  it("failures: 409 promijenjeno, a network error nepoznato", async () => {
    expect(await updateConsultationSlot(answer(409, null), DOC, SLOT, "confirm")).toEqual({ kind: "promijenjeno" });
    expect(await updateConsultationSlot(broken, DOC, SLOT, "confirm")).toEqual(nepoznato);
    expect(await updateConsultationSlot(answer(401, null), DOC, SLOT, "confirm")).toEqual({ kind: "session-expired" });
  });
});

describe("validStartsAt", () => {
  it("accepts a real time and refuses the rest", () => {
    expect(validStartsAt(T1)).toBe(true);
    expect(validStartsAt("2026-13-45T99:00:00Z")).toBe(false);
    expect(validStartsAt("21.11.2026.")).toBe(false);
  });
});
