import { describe, expect, it, vi } from "vitest";

import { addMaterial, readMaterial, readMaterials, removeMaterial } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
// The test double stands where createApi() stands; it answers by operation.
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const NEW = { title: "Intervju A", kind: "interview", text: "Izmišljeni tekst." } as const;
const MATERIAL = { id: "m1", title: "Intervju A", kind: "interview", text: "Izmišljeni tekst.", createdOn: "2026-04-01", segmentCount: 0, locked: false };

describe("readMaterials", () => {
  it("returns the rows of the answer", async () => {
    expect(await readMaterials(api({ ok: true, status: 200, body: { materials: [] } }))).toEqual({ kind: "ok", materials: [] });
  });
  it("keeps signed out and unavailable apart, and neither is an empty list", async () => {
    expect(await readMaterials(api(fail(401, "unauthorized")))).toEqual({ kind: "signedOut" });
    expect(await readMaterials(api(fail(503, "unavailable")))).toEqual({ kind: "unavailable" });
    expect(await readMaterials(api(fail(0, "unexpected")))).toEqual({ kind: "unavailable" });
  });
});

describe("readMaterial", () => {
  it("reads one, and another student's material reads as not found, not as unavailable", async () => {
    expect(await readMaterial(api({ ok: true, status: 200, body: MATERIAL }), "m1")).toEqual({ kind: "ok", material: MATERIAL });
    expect(await readMaterial(api(fail(404, "not_found")), "x")).toEqual({ kind: "notFound" });
    expect(await readMaterial(api(fail(503, "unavailable")), "x")).toEqual({ kind: "unavailable" });
    expect(await readMaterial(api(fail(401, "unauthorized")), "x")).toEqual({ kind: "signedOut" });
  });
  it("asks for the id it was given", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 200, body: MATERIAL }));
    await readMaterial(call as never, "m1");
    expect(call).toHaveBeenCalledWith("student.qual-material.get", { params: { id: "m1" }, query: undefined, body: undefined });
  });
});

describe("addMaterial", () => {
  it("is saved only on the server's 2xx, with the kept material", async () => {
    expect(await addMaterial(api({ ok: true, status: 201, body: MATERIAL }), NEW)).toEqual({ kind: "saved", material: MATERIAL });
  });
  it("names a refusal, and an empty or odd answer is unknown, never saved", async () => {
    expect(await addMaterial(api(fail(401, "unauthorized")), NEW)).toEqual({ kind: "signedOut" });
    expect(await addMaterial(api(fail(409, "conflict")), NEW)).toEqual({ kind: "conflict" });
    expect(await addMaterial(api(fail(422, "invalid_input")), NEW)).toEqual({ kind: "invalid" });
    expect(await addMaterial(api(fail(413, "body_too_large")), NEW)).toEqual({ kind: "invalid" });
    expect(await addMaterial(api(fail(503, "unavailable")), NEW)).toEqual({ kind: "unknown" });
    expect(await addMaterial(api(fail(0, "unexpected")), NEW)).toEqual({ kind: "unknown" });
  });
});

describe("removeMaterial", () => {
  it("is removed only on the server's 2xx", async () => {
    expect(await removeMaterial(api({ ok: true, status: 204, body: undefined }), "m1")).toEqual({ kind: "removed" });
    expect(await removeMaterial(api(fail(404, "not_found")), "m1")).toEqual({ kind: "notFound" });
    expect(await removeMaterial(api(fail(401, "unauthorized")), "m1")).toEqual({ kind: "signedOut" });
    expect(await removeMaterial(api(fail(503, "unavailable")), "m1")).toEqual({ kind: "unknown" });
  });
});

describe("a rejected transport", () => {
  const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
  it("is unavailable for a read and unknown for a write, never an exception", async () => {
    expect(await readMaterials(boom)).toEqual({ kind: "unavailable" });
    expect(await readMaterial(boom, "m1")).toEqual({ kind: "unavailable" });
    expect(await addMaterial(boom, NEW)).toEqual({ kind: "unknown" });
    expect(await removeMaterial(boom, "m1")).toEqual({ kind: "unknown" });
  });
});
