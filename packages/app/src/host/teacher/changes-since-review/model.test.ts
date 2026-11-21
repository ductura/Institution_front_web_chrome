import { describe, expect, it } from "vitest";

import { fakeChangesPort, FAKE_CHANGES } from "./fake-port";
import { changesSince, markWorkReviewed, type ChangesPort } from "./model";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";

describe("changes since the last review (WEB-1704)", () => {
  it("lists only what came after the review, oldest first", () => {
    expect(changesSince("2026-11-19T12:00:00.000Z", [...FAKE_CHANGES].reverse()).map((c) => c.id)).toEqual(["c2", "c3"]);
    expect(changesSince(null, FAKE_CHANGES).map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(changesSince("2026-11-22T00:00:00.000Z", FAKE_CHANGES)).toEqual([]);
  });

  it("empties the list once the work is marked reviewed", async () => {
    const port = fakeChangesPort();
    const mark = await markWorkReviewed(port, ID);
    expect(mark.kind).toBe("marked");
    const read = await port.read(ID);
    if (read.kind !== "ready") throw new Error("expected ready");
    expect(changesSince(read.reviewedAt, read.changes).map((c) => c.id)).toEqual([]);
  });

  it("treats a throwing port or a bad time as unknown", async () => {
    const throwing: ChangesPort = { read: async () => ({ kind: "unavailable" }), markReviewed: async () => { throw new Error("x"); } };
    expect(await markWorkReviewed(throwing, ID)).toEqual({ kind: "unknown" });
    const bad: ChangesPort = { ...throwing, markReviewed: async () => ({ kind: "marked", reviewedAt: "nije vrijeme" }) };
    expect(await markWorkReviewed(bad, ID)).toEqual({ kind: "unknown" });
  });
});
