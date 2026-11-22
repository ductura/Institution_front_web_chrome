import { describe, expect, it } from "vitest";

import type { ConsultationSlot } from "@/client/consultation-slots";

import { consultationSlotsHr as t } from "./messages.hr";
import { IDLE_FORM, actionsFor, afterWrite, failureText, localToIso, statusText, withSlot } from "./slots-logic";

const mk = (status: ConsultationSlot["state"], n = 1): ConsultationSlot =>
  ({ id: `2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c9${n}`, startsAt: "2026-11-21T12:00:00.000Z", proposedAt: "2026-11-20T11:11:00.000Z", state: status });

describe("actionsFor", () => {
  it("the teacher answers a request, the student takes a proposal, a confirmed slot has none", () => {
    expect(actionsFor("teacher", mk("requested"))).toEqual(["confirm", "counter"]);
    expect(actionsFor("student", mk("requested"))).toEqual([]);
    expect(actionsFor("student", mk("countered"))).toEqual(["accept"]);
    expect(actionsFor("teacher", mk("countered"))).toEqual([]);
    expect(actionsFor("teacher", mk("confirmed"))).toEqual([]);
    expect(actionsFor("student", mk("confirmed"))).toEqual([]);
  });
});

describe("texts", () => {
  it("each side reads its own wording; confirmed is the same for both", () => {
    expect(statusText("student", mk("requested"))).toBe("čeka mentora");
    expect(statusText("teacher", mk("requested"))).toBe("čeka Vaš odgovor");
    expect(statusText("student", mk("countered"))).toBe("mentor predlaže drugi termin");
    expect(statusText("student", mk("confirmed"))).toBe(statusText("teacher", mk("confirmed")));
  });
});

describe("localToIso", () => {
  it("turns a datetime-local value into an ISO time; empty or malformed is null", () => {
    expect(localToIso("2026-11-21T13:00")).toBe(new Date("2026-11-21T13:00").toISOString());
    expect(localToIso("")).toBeNull();
    expect(localToIso("21. 11. 2026.")).toBeNull();
    expect(localToIso("2026-13-45T25:00")).toBeNull();
  });
});

describe("withSlot", () => {
  it("replaces in place, adds a new one first", () => {
    const [a, b] = [mk("requested", 1), mk("requested", 2)];
    const saved = { ...a, state: "confirmed" as const };
    expect(withSlot([a, b], saved)).toEqual([saved, b]);
    expect(withSlot([b], a)).toEqual([a, b]);
  });
});

describe("afterWrite", () => {
  const typed = { open: true, draft: "2026-11-21T13:00", busy: true, error: null };
  it("a network error keeps the form as typed and shows the reason", () => {
    expect(afterWrite(typed, { kind: "nepoznato" })).toEqual({ ...typed, busy: false, error: t.errors.unknown });
  });
  it("every failure keeps the draft; only a saved slot clears the form", () => {
    for (const o of [{ kind: "session-expired" }, { kind: "promijenjeno" }, { kind: "greska", code: "invalid" }] as const) {
      expect(afterWrite(typed, o)).toMatchObject({ draft: typed.draft, open: true, busy: false, error: failureText(o) });
    }
    expect(afterWrite(typed, { kind: "saved", slot: mk("requested") })).toEqual(IDLE_FORM);
  });
});
