import { describe, expect, it } from "vitest";

import { openRequests } from "./duplicate";

const A = "0b6d6f1e-3c1a-4f7e-9a51-2f4a7d3c9e10";

describe("openRequests (NF-7 OA-6)", () => {
  it("knows a student only after a request was recorded or refused as already open", () => {
    const open = openRequests();
    expect(open.has(A)).toBe(false);
    open.add(A);
    expect(open.has(A)).toBe(true);
  });

  it("compares the mark as the server does, whatever its case and surrounding spaces", () => {
    const open = openRequests();
    open.add(A.toUpperCase());
    expect(open.has(` ${A} `)).toBe(true);
    expect(open.has("1b6d6f1e-3c1a-4f7e-9a51-2f4a7d3c9e10")).toBe(false);
  });

  it("is per page: a new page starts empty", () => {
    openRequests().add(A);
    expect(openRequests().has(A)).toBe(false);
  });
});
