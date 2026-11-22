import { describe, expect, it } from "vitest";

import { createFakeEventDisputes, disputeLength, isValidDisputeText, MAX_DISPUTE_LENGTH, type EventDispute } from "./event-disputes";

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
