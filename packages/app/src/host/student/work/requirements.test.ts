import { describe, expect, it } from "vitest";

import { readWordRange } from "./requirements";

describe("readWordRange", () => {
  it("gives the range the server names", async () => {
    const local = async () => ({ ok: true, status: 200, body: { wordRange: { min: 1200, max: 1600 } } }) as const;
    expect(await readWordRange("a", local)).toEqual({ min: 1200, max: 1600 });
  });
  it("leaves the range out when the read fails or throws", async () => {
    expect(await readWordRange("a", async () => ({ ok: false, status: 500, code: "x" }))).toBeNull();
    expect(await readWordRange("a", async () => { throw new Error("down"); })).toBeNull();
  });
});
