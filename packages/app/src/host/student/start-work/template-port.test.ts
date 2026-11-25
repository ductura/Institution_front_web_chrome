import { describe, expect, it, vi } from "vitest";

import { sharedTemplateReads } from "./template-port";
import type { TemplateRead } from "./template";

const A = "20000000-0000-4000-8000-000000000001";
const B = "20000000-0000-4000-8000-000000000002";

describe("sharedTemplateReads", () => {
  it("reads each assignment once however many cards ask", async () => {
    const read = vi.fn(async (_id: string): Promise<TemplateRead> => ({ kind: "none" }));
    const shared = sharedTemplateReads(read);
    await Promise.all([shared(A), shared(A), shared(B), shared(A)]);
    await shared(B);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls.map((c) => c[0])).toEqual([A, B]);
  });

  it("does not keep a failed read, so the next card asks again", async () => {
    const read = vi.fn<(id: string) => Promise<TemplateRead>>()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce({ kind: "none" });
    const shared = sharedTemplateReads(read);
    expect(await shared(A)).toEqual({ kind: "unavailable" });
    expect(await shared(A)).toEqual({ kind: "none" });
    await shared(A);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
