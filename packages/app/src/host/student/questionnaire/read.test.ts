import { describe, expect, it, vi } from "vitest";

import { readForm, readList, sendSheet } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const ID = "11111111-1111-4111-8111-111111111111";
const SHEET = { answers: [{ questionId: "q1", value: "da" }] };

describe("readList", () => {
  it("returns the rows, and an empty list only when the server said so", async () => {
    expect(await readList(api({ ok: true, status: 200, body: { questionnaires: [] } }))).toEqual({ kind: "ok", questionnaires: [] });
  });
  it("keeps signed out and unavailable apart, and neither is an empty list", async () => {
    expect(await readList(api(fail(401, "unauthorized")))).toEqual({ kind: "signedOut" });
    expect(await readList(api(fail(503, "unavailable")))).toEqual({ kind: "unavailable" });
    expect(await readList(api(fail(0, "unexpected")))).toEqual({ kind: "unavailable" });
  });
});

describe("readForm", () => {
  it("a closed or someone else's questionnaire is not found, not unavailable", async () => {
    expect(await readForm(api(fail(404, "not_found")), ID)).toEqual({ kind: "notFound" });
    expect(await readForm(api(fail(503, "unavailable")), ID)).toEqual({ kind: "unavailable" });
    expect(await readForm(api(fail(401, "unauthorized")), ID)).toEqual({ kind: "signedOut" });
  });
  it("asks for the id it was given", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 200, body: { id: ID } }));
    await readForm(call as never, ID);
    expect(call).toHaveBeenCalledWith("student.questionnaire.get", { params: { id: ID }, query: undefined, body: undefined });
  });
});

describe("sendSheet", () => {
  it("is saved only on the server's 2xx", async () => {
    expect(await sendSheet(api({ ok: true, status: 204, body: undefined }), ID, SHEET)).toEqual({ kind: "saved" });
  });
  it("names each refusal; an odd or lost answer is unknown, never saved", async () => {
    expect(await sendSheet(api(fail(401, "unauthorized")), ID, SHEET)).toEqual({ kind: "signedOut" });
    expect(await sendSheet(api(fail(409, "conflict")), ID, SHEET)).toEqual({ kind: "conflict" });
    expect(await sendSheet(api(fail(404, "not_found")), ID, SHEET)).toEqual({ kind: "notFound" });
    expect(await sendSheet(api(fail(422, "invalid_input")), ID, SHEET)).toEqual({ kind: "invalid" });
    expect(await sendSheet(api(fail(503, "unavailable")), ID, SHEET)).toEqual({ kind: "unknown" });
    expect(await sendSheet(api(fail(403, "origin_mismatch")), ID, SHEET)).toEqual({ kind: "unknown" });
  });
  it("posts the sheet to the questionnaire it was given", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 204, body: undefined }));
    await sendSheet(call as never, ID, SHEET);
    expect(call).toHaveBeenCalledWith("student.questionnaire-responses.post", { params: { id: ID }, query: undefined, body: SHEET });
  });
  it("a rejected transport is unknown for a write and unavailable for a read, never an exception", async () => {
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
    expect(await sendSheet(boom, ID, SHEET)).toEqual({ kind: "unknown" });
    expect(await readList(boom)).toEqual({ kind: "unavailable" });
    expect(await readForm(boom, ID)).toEqual({ kind: "unavailable" });
  });
});
