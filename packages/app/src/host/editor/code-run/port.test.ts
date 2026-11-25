import { describe, expect, it } from "vitest";

import { fakeReadCodeTests } from "./fake-port.ts";
import { readCodeTests } from "./port.ts";

describe("readCodeTests", () => {
  it("reads the tests of the assignment", async () => {
    const r = await readCodeTests("a", fakeReadCodeTests);
    expect(r.kind).toBe("ready");
    expect(r.kind === "ready" && r.tests.length).toBe(2);
  });
  it("an assignment with no tests, or not the student's (404), is `none`", async () => {
    expect(await readCodeTests("a", async () => ({ ok: true, body: { revisionNo: 0, language: "javascript", tests: [] } }))).toEqual({ kind: "none" });
    expect(await readCodeTests("a", async () => ({ ok: false, status: 404 }))).toEqual({ kind: "none" });
  });
  it("503, a network failure and a broken answer are never `none`", async () => {
    expect(await readCodeTests("a", async () => ({ ok: false, status: 503 }))).toEqual({ kind: "unavailable" });
    expect(await readCodeTests("a", async () => { throw new Error("offline"); })).toEqual({ kind: "unavailable" });
    expect(await readCodeTests("a", async () => ({ ok: true, body: {} }))).toEqual({ kind: "unavailable" });
    expect(await readCodeTests("a", async () => ({ ok: true, body: undefined }))).toEqual({ kind: "unavailable" });
  });
});
