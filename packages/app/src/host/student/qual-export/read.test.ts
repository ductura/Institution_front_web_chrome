import { describe, expect, it, vi } from "vitest";

import { readExport, readMaterialChoices } from "./read";

const call = (answer: unknown) => vi.fn(async () => answer) as never;
const EXPORT = { schema: "qualitative-export-v1", codebook: [], segments: [], counts: [] };

describe("readExport", () => {
  it("asks for one material only when it is given", async () => {
    const fn = vi.fn(async () => ({ ok: true, status: 200, body: EXPORT }));
    await readExport(fn as never, null);
    await readExport(fn as never, "m1");
    expect(fn.mock.calls.map((c) => (c as unknown as [string, { query: unknown }])[1].query)).toEqual([{}, { materialId: "m1" }]);
  });
  it("tells a 404 (also another student's material) from a failure and from a signed-out session", async () => {
    expect(await readExport(call({ ok: false, status: 404, code: "not_found" }), "x")).toEqual({ kind: "notFound" });
    expect(await readExport(call({ ok: false, status: 401, code: "unauthorized" }), null)).toEqual({ kind: "signedOut" });
    expect(await readExport(call({ ok: false, status: 503, code: "unavailable" }), null)).toEqual({ kind: "unavailable" });
  });
  it("an answer that never came is unavailable, never an empty export", async () => {
    expect(await readExport(vi.fn(async () => { throw new Error("down"); }) as never, null)).toEqual({ kind: "unavailable" });
  });
});

describe("readMaterialChoices", () => {
  it("keeps only the id and the title", async () => {
    const r = await readMaterialChoices(call({ ok: true, status: 200, body: { materials: [{ id: "a", title: "Intervju A", kind: "interview", text: "x" }] } }));
    expect(r).toEqual({ kind: "ok", materials: [{ id: "a", title: "Intervju A" }] });
  });
  it("a refusal is not an empty list", async () => {
    expect(await readMaterialChoices(call({ ok: false, status: 503, code: "unavailable" }))).toEqual({ kind: "unavailable" });
  });
});
