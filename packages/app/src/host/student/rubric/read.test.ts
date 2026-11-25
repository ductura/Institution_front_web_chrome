import { describe, expect, it, vi } from "vitest";

import { readRubric } from "./read";

const A = "11111111-1111-4111-8111-111111111111";
const LEVELS = [{ label: "Slabo", descriptor: "" }, { label: "Dobro", descriptor: "Jasno." }, { label: "Odlično", descriptor: "Vrlo jasno." }];
const call = (answer: unknown) => vi.fn(async () => answer) as never;

describe("readRubric (WEB-V17-RUBRIC-STUDENT)", () => {
  it("reads the criteria of the assignment through the contract operation", async () => {
    const fn = vi.fn(async () => ({ ok: true, status: 200, body: { version: 2, criteria: [{ id: "topic", title: "Tema", levels: LEVELS }] } }));
    expect(await readRubric(fn as never, A)).toMatchObject({ kind: "ok", version: 2 });
    expect(fn).toHaveBeenCalledWith("student.assignment-rubric.get", { params: { assignmentId: A }, query: undefined, body: undefined });
  });
  it("an answer without criteria is empty, not a list of nothing", async () => {
    expect(await readRubric(call({ ok: true, status: 200, body: { version: 0, criteria: [] } }), A)).toEqual({ kind: "empty" });
  });
  it("another course's or an unknown assignment reads as not found", async () => {
    expect(await readRubric(call({ ok: false, status: 404, code: "not_found" }), A)).toEqual({ kind: "notFound" });
  });
  it("a lost session is signed out, and a 503 or a broken connection is unavailable, never empty", async () => {
    expect(await readRubric(call({ ok: false, status: 401, code: "unauthorized" }), A)).toEqual({ kind: "signedOut" });
    expect(await readRubric(call({ ok: false, status: 503, code: "unavailable" }), A)).toEqual({ kind: "unavailable" });
    expect(await readRubric(vi.fn(async () => { throw new Error("offline"); }) as never, A)).toEqual({ kind: "unavailable" });
  });
});
