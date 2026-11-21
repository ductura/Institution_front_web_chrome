import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { timeMachineMessages } from "./messages.hr";
import { FAKE_VERSIONS, fakeTimeMachinePort } from "./fake-port";
import { diffParts, orderedPair, orderVersions } from "./model";

describe("time machine model", () => {
  it("orders versions newest first and drops duplicate revisions", () => {
    const ordered = orderVersions([...FAKE_VERSIONS, FAKE_VERSIONS[0]!].toReversed());
    expect(ordered.map((v) => v.revision)).toEqual([3, 2, 1]);
  });
  it("puts the older revision first and rejects the same one twice", () => {
    expect(orderedPair(3, 1)).toEqual({ from: 1, to: 3 });
    expect(orderedPair(2, 2)).toBeNull();
  });
  it("builds diff parts verbatim with block breaks", async () => {
    const read = await fakeTimeMachinePort().compare("d", 1, 3);
    if (read.kind !== "ready") throw new Error("ready expected");
    const parts = diffParts([...read.blocks, ...read.blocks]);
    expect(parts.filter((p) => p.kind === "removed").map((p) => p.text)).toEqual(["stari", "stari"]);
    expect(parts.some((p) => p.text === "\n")).toBe(true);
    expect(parts.filter((p) => p.text === " ")).toEqual([]);
  });
  it("shows no duration, pace or size of change", () => {
    const joined = Object.values(timeMachineMessages).map((v) => (typeof v === "string" ? v : v("checkpoint", 1, "2026-11-20T09:15:00.000Z"))).join(" ");
    expect(joined).not.toMatch(/trajanj|ritam|brzin|minuta rada|riječi|razlika od/i);
  });
  it("holds no forbidden term (PRODUCT §5)", () => {
    for (const value of Object.values(timeMachineMessages)) if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
