import { describe, expect, it, vi } from "vitest";

import { readContribution, readTeam, teamAction } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const A = "11111111-1111-4111-8111-111111111111";

describe("readTeam", () => {
  it("asks for the assignment by its id and returns the view of the answer", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200, body: { state: "disabled" } }));
    expect(await readTeam(call as never, A)).toEqual({ kind: "ok", view: { state: "disabled" } });
    expect(call).toHaveBeenCalledWith("student.work-team.get", { params: { assignmentId: A }, query: undefined, body: undefined });
  });
  it("reads another course's or an unknown assignment as not found, never as an empty team", async () => {
    expect(await readTeam(api(fail(404, "not_found")), A)).toEqual({ kind: "notFound" });
  });
  it("keeps signed out and unavailable apart", async () => {
    expect(await readTeam(api(fail(401, "unauthorized")), A)).toEqual({ kind: "signedOut" });
    expect(await readTeam(api(fail(503, "unavailable")), A)).toEqual({ kind: "unavailable" });
    expect(await readTeam(api(fail(0, "unexpected")), A)).toEqual({ kind: "unavailable" });
  });
  it("is unavailable, not an exception, when the transport rejects", async () => {
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
    expect(await readTeam(boom, A)).toEqual({ kind: "unavailable" });
    expect(await readContribution(boom, A)).toEqual({ kind: "unavailable" });
  });
});

describe("readContribution", () => {
  it("passes the closed states through and refuses to call a failure an empty state", async () => {
    expect(await readContribution(api({ ok: true, status: 200, body: { state: "pending" } }), A)).toEqual({ kind: "ok", view: { state: "pending" } });
    expect(await readContribution(api(fail(503, "unavailable")), A)).toEqual({ kind: "unavailable" });
    expect(await readContribution(api(fail(404, "not_found")), A)).toEqual({ kind: "notFound" });
  });
});

describe("teamAction", () => {
  const done = { state: "member", team: { teamId: "t", members: [{ givenName: "A", familyName: "B" }] } };
  it("is done only on the server's 200 and carries the state after the action", async () => {
    expect(await teamAction(api({ ok: true, status: 200, body: done }), A, { action: "create" })).toEqual({ kind: "done", view: done });
  });
  it.each([
    [fail(404, "not_found"), "notFound"],
    [fail(409, "conflict"), "conflict"],
    [fail(422, "invalid_input"), "invalid"],
    [fail(0, "client_rejected"), "invalid"],
    [fail(401, "unauthorized"), "signedOut"],
    [fail(503, "unavailable"), "unknown"],
    [fail(0, "unexpected"), "unknown"],
  ] as const)("maps %j to %s", async (answer, kind) => {
    expect((await teamAction(api(answer), A, { action: "leave" })).kind).toBe(kind);
  });
  it("is unknown when the transport rejects: the action may have been recorded", async () => {
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
    expect(await teamAction(boom, A, { action: "leave" })).toEqual({ kind: "unknown" });
  });
});
