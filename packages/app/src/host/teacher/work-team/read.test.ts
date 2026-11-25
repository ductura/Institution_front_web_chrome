import { describe, expect, it, vi } from "vitest";

import { createTeam, memberAction, putSetting, readSetting, readTeamContribution, readTeams } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const A = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const SETTING = { enabled: true, minSize: 2, maxSize: 4, formation: "student_choice" } as const;

describe("reads", () => {
  it("ask for the assignment (and the team) by id", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200, body: { state: "none" } }));
    await readTeamContribution(call as never, A, T);
    expect(call).toHaveBeenCalledWith("teacher.work-team-contribution.get", { params: { assignmentId: A, teamId: T }, query: undefined, body: undefined });
  });
  it("read another course's or an unknown assignment as not found, and a fault as unavailable, never as an empty list", async () => {
    for (const read of [readSetting, readTeams]) {
      expect(await read(api(fail(404, "not_found")), A)).toEqual({ kind: "notFound" });
      expect(await read(api(fail(503, "unavailable")), A)).toEqual({ kind: "unavailable" });
      expect(await read(api(fail(401, "unauthorized")), A)).toEqual({ kind: "signedOut" });
    }
    expect(await readTeamContribution(api(fail(404, "not_found")), A, T)).toEqual({ kind: "notFound" });
  });
  it("are unavailable, not an exception, when the transport rejects", async () => {
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
    expect(await readSetting(boom, A)).toEqual({ kind: "unavailable" });
    expect(await readTeams(boom, A)).toEqual({ kind: "unavailable" });
    expect(await readTeamContribution(boom, A, T)).toEqual({ kind: "unavailable" });
  });
});

describe("writes", () => {
  it("are done only on the server's answer", async () => {
    expect(await putSetting(api({ ok: true, status: 200, body: SETTING }), A, SETTING)).toEqual({ kind: "done", value: SETTING });
    expect(await createTeam(api({ ok: true, status: 201, body: { teamId: T } }), A)).toEqual({ kind: "done", value: { teamId: T } });
    expect((await memberAction(api({ ok: true, status: 200, body: { updated: true } }), A, T, { studentId: A, action: "add" })).kind).toBe("done");
  });
  it.each([
    [fail(404, "not_found"), "notFound"],
    [fail(409, "conflict"), "conflict"],
    [fail(422, "invalid_input"), "invalid"],
    [fail(401, "unauthorized"), "signedOut"],
    [fail(503, "unavailable"), "unknown"],
  ] as const)("map %j to %s", async (answer, kind) => {
    expect((await putSetting(api(answer), A, SETTING)).kind).toBe(kind);
    expect((await createTeam(api(answer), A)).kind).toBe(kind);
    expect((await memberAction(api(answer), A, T, { studentId: A, action: "remove" })).kind).toBe(kind);
  });
  it("a lost answer is unknown: the write may have been recorded", async () => {
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
    expect(await putSetting(boom, A, SETTING)).toEqual({ kind: "unknown" });
    expect(await createTeam(boom, A)).toEqual({ kind: "unknown" });
    expect(await memberAction(boom, A, T, { studentId: A, action: "add" })).toEqual({ kind: "unknown" });
  });
});
