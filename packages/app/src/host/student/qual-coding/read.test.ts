import { describe, expect, it, vi } from "vitest";

import { addCode, addSegment, patchCode, readCodes, readSegments, removeCode, removeSegment } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const CODE = { id: "c1", name: "Motivacija", description: "", order: 0 };
const SEG = { id: "s1", codeId: "c1", paragraph: 0, start: 0, end: 4, quote: "Prvi", memo: null, createdOn: "2026-04-01" };
const ANCHOR = { paragraph: 0, start: 0, end: 4, quote: "Prvi" };

describe("readCodes and readSegments", () => {
  it("return the lists of the answer", async () => {
    expect(await readCodes(api({ ok: true, status: 200, body: { codes: [CODE] } }))).toEqual({ kind: "ok", codes: [CODE] });
    expect(await readSegments(api({ ok: true, status: 200, body: { segments: [SEG] } }), "m1")).toEqual({ kind: "ok", segments: [SEG] });
  });
  it("keep signed out, not found and unavailable apart; none is an empty list", async () => {
    expect(await readCodes(api(fail(401, "unauthorized")))).toEqual({ kind: "signedOut" });
    expect(await readCodes(api(fail(503, "unavailable")))).toEqual({ kind: "unavailable" });
    expect(await readSegments(api(fail(404, "not_found")), "x")).toEqual({ kind: "notFound" });
    expect(await readSegments(api(fail(503, "unavailable")), "x")).toEqual({ kind: "unavailable" });
    expect(await readSegments(api(fail(401, "session_expired")), "x")).toEqual({ kind: "signedOut" });
  });
  it("ask for the material it was given", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 200, body: { segments: [] } }));
    await readSegments(call as never, "m1");
    expect(call).toHaveBeenCalledWith("student.qual-segments.get", { params: { id: "m1" }, query: undefined, body: undefined });
  });
});

describe("writes", () => {
  it("are saved only on the server's 2xx, with what the server kept", async () => {
    expect(await addCode(api({ ok: true, status: 201, body: CODE }), { name: "Motivacija" })).toEqual({ kind: "saved", value: CODE });
    expect(await patchCode(api({ ok: true, status: 200, body: CODE }), "c1", { order: 1 })).toEqual({ kind: "saved", value: CODE });
    expect(await addSegment(api({ ok: true, status: 201, body: SEG }), "m1", { codeId: "c1", anchor: ANCHOR })).toEqual({ kind: "saved", value: SEG });
  });
  it("name a refusal; an empty or odd answer is unknown, never saved", async () => {
    for (const run of [
      (a: Answer) => addCode(api(a), { name: "x" }),
      (a: Answer) => patchCode(api(a), "c1", { name: "x" }),
      (a: Answer) => addSegment(api(a), "m1", { codeId: "c1", anchor: ANCHOR }),
    ]) {
      expect(await run(fail(401, "unauthorized"))).toEqual({ kind: "signedOut" });
      expect(await run(fail(404, "not_found"))).toEqual({ kind: "notFound" });
      expect(await run(fail(409, "conflict"))).toEqual({ kind: "conflict" });
      expect(await run(fail(422, "invalid_input"))).toEqual({ kind: "invalid" });
      expect(await run(fail(503, "unavailable"))).toEqual({ kind: "unknown" });
      expect(await run(fail(0, "unexpected"))).toEqual({ kind: "unknown" });
    }
  });
});

describe("removeCode", () => {
  it("asks first without confirm, and a conflict means the page must ask the student", async () => {
    const call = vi.fn(async () => fail(409, "conflict"));
    expect(await removeCode(call as never, "c1", false)).toEqual({ kind: "needsConfirm" });
    expect(call).toHaveBeenCalledWith("student.qual-code.delete", { params: { id: "c1" }, query: {}, body: undefined });
  });
  it("sends confirm only when told, and a conflict after the confirmation is unknown, not a loop", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 204, body: undefined }));
    expect(await removeCode(call as never, "c1", true)).toEqual({ kind: "removed" });
    expect(call).toHaveBeenCalledWith("student.qual-code.delete", { params: { id: "c1" }, query: { confirm: "true" }, body: undefined });
    expect(await removeCode(api(fail(409, "conflict")), "c1", true)).toEqual({ kind: "unknown" });
  });
  it("names the other outcomes", async () => {
    expect(await removeCode(api(fail(404, "not_found")), "c1", false)).toEqual({ kind: "notFound" });
    expect(await removeCode(api(fail(401, "unauthorized")), "c1", false)).toEqual({ kind: "signedOut" });
    expect(await removeCode(api(fail(503, "unavailable")), "c1", false)).toEqual({ kind: "unknown" });
  });
});

describe("removeSegment", () => {
  it("is removed only on the server's 2xx", async () => {
    expect(await removeSegment(api({ ok: true, status: 204, body: undefined }), "s1")).toEqual({ kind: "removed" });
    expect(await removeSegment(api(fail(404, "not_found")), "s1")).toEqual({ kind: "notFound" });
    expect(await removeSegment(api(fail(401, "unauthorized")), "s1")).toEqual({ kind: "signedOut" });
    expect(await removeSegment(api(fail(503, "unavailable")), "s1")).toEqual({ kind: "unknown" });
  });
});

describe("a rejected transport", () => {
  const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
  it("is unavailable for a read and unknown for a write, never an exception", async () => {
    expect(await readCodes(boom)).toEqual({ kind: "unavailable" });
    expect(await readSegments(boom, "m1")).toEqual({ kind: "unavailable" });
    expect(await addCode(boom, { name: "x" })).toEqual({ kind: "unknown" });
    expect(await patchCode(boom, "c1", {})).toEqual({ kind: "unknown" });
    expect(await addSegment(boom, "m1", { codeId: "c1", anchor: ANCHOR })).toEqual({ kind: "unknown" });
    expect(await removeCode(boom, "c1", false)).toEqual({ kind: "unknown" });
    expect(await removeSegment(boom, "s1")).toEqual({ kind: "unknown" });
  });
});
