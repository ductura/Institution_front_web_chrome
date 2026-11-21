// The provenance port's fake (WEB-1220): one read for every reader, a fresh copy each time, and
// numbers that match vector 9.1 of the SRV-1220 proposal.
import { describe, expect, it } from "vitest";

import { createFakeProvenance, fakeShare, screenProvenance, VECTOR_9_1 } from "./provenance-fake";

describe("fake provenance", () => {
  it("holds vector 9.1: 365 code points split 195/64/63/34/9, shown as 53/18/17/9/3 %", () => {
    expect(VECTOR_9_1.kind).toBe("ready");
    if (VECTOR_9_1.kind !== "ready") return;
    expect(VECTOR_9_1.share.totalCodePoints).toBe(365);
    expect(VECTOR_9_1.share.categories.map((c) => c.codePoints)).toEqual([195, 64, 63, 34, 9]);
    expect(VECTOR_9_1.share.categories.map((c) => c.percent)).toEqual([53, 18, 17, 9, 3]);
    expect(VECTOR_9_1.share.categories.map((c) => c.category)).toEqual(["written", "ai_transferred", "pasted", "imported", "unattributed"]);
  });

  it("answers a held submission, and none for one it does not hold", async () => {
    const port = createFakeProvenance({ s1: VECTOR_9_1, s2: { kind: "pending" } });
    expect(await port.read("s1")).toEqual(VECTOR_9_1);
    expect(await port.read("s2")).toEqual({ kind: "pending" });
    expect(await port.read("missing")).toEqual({ kind: "none" });
    expect(await port.read("constructor")).toEqual({ kind: "none" });
  });

  it("reads a submission it does not hold as the fallback", async () => {
    const port = createFakeProvenance({ s1: { kind: "disabled" } }, VECTOR_9_1);
    expect(await port.read("s1")).toEqual({ kind: "disabled" });
    expect(await port.read("other")).toEqual(VECTOR_9_1);
  });

  it("gives every read a fresh copy", async () => {
    const port = createFakeProvenance({ s1: VECTOR_9_1 });
    const first = await port.read("s1");
    if (first.kind === "ready") (first.share.categories[0] as { percent: number }).percent = 99;
    expect(await port.read("s1")).toEqual(VECTOR_9_1);
  });

  it("gives the screens the same record for any work", async () => {
    expect(await screenProvenance.read("rad-izmisljeni-1")).toEqual(await screenProvenance.read("doc-izmisljeni-2"));
  });

  it("builds an empty share with zero total", () => {
    expect(fakeShare([], []).totalCodePoints).toBe(0);
  });
});
